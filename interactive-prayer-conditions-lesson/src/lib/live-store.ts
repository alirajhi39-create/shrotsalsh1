import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { livePlayers, liveRooms } from "@/db/schema";
import { ensureSchema } from "@/db/bootstrap";
import { ensureSeeded } from "./seed";
import { buildLiveDeck, type LiveQuestion } from "./live-quiz";
import { generateRoomCode } from "./auth";
import type { RoomMode } from "./rooms";

/**
 * تخزين غرف المسابقة في قاعدة البيانات حتى تعمل عبر كل نسخ الدوال على Vercel،
 * فلا تضيع الغرفة بين جهاز المعلم وأجهزة الطلاب.
 */

export type StoredPlayer = { playerId: string; name: string; score: number; choice: string | null; answered: boolean };

export async function createRoom(params: {
  teacherId: number;
  mode: RoomMode;
  includeBook: boolean;
  seconds: number;
}): Promise<{ code: string; deck: LiveQuestion[] }> {
  await ensureSchema();
  await ensureSeeded();
  const deck = await buildLiveDeck(params.mode, params.teacherId, { includeBook: params.includeBook });
  let code = generateRoomCode();
  for (let i = 0; i < 40; i++) {
    const [dup] = await db
      .select({ id: liveRooms.id })
      .from(liveRooms)
      .where(and(eq(liveRooms.code, code), eq(liveRooms.closed, false)))
      .limit(1);
    if (!dup) break;
    code = generateRoomCode();
  }
  await db.insert(liveRooms).values({
    code,
    teacherId: params.teacherId,
    mode: params.mode,
    deck: deck as unknown[],
    currentIndex: 0,
    reveal: false,
    finished: false,
    closed: false,
    // المسابقة لا تبدأ فعليًا إلا بضغط «بدء المسابقة»
    started: false,
    seconds: Math.max(0, Math.min(300, Math.round(params.seconds))),
  });
  return { code, deck };
}

export async function getRoomByCode(code: string) {
  await ensureSchema();
  const [row] = await db.select().from(liveRooms).where(eq(liveRooms.code, code)).limit(1);
  return row ?? null;
}

export async function listPlayers(roomId: number): Promise<StoredPlayer[]> {
  const rows = await db
    .select({ playerId: livePlayers.playerId, name: livePlayers.name, score: livePlayers.score, choice: livePlayers.choice, answered: livePlayers.answered })
    .from(livePlayers)
    .where(eq(livePlayers.roomId, roomId))
    .orderBy(asc(livePlayers.joinedAt));
  return rows.map((r) => ({ playerId: r.playerId, name: r.name, score: r.score, choice: r.choice, answered: r.answered }));
}

export async function joinRoom(code: string, name: string) {
  const room = await getRoomByCode(code);
  if (!room || room.closed) return null;
  const players = await listPlayers(room.id);
  const existing = players.find((p) => p.name === name);
  if (existing) return { room, playerId: existing.playerId };
  const playerId = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 24);
  await db.insert(livePlayers).values({ roomId: room.id, playerId, name }).onConflictDoNothing();
  return { room, playerId };
}

/** بدء المسابقة: يفتح السؤال الأول على أجهزة الطلاب */
export async function startRoom(code: string) {
  const room = await getRoomByCode(code);
  if (!room) return null;
  await db
    .update(liveRooms)
    .set({ started: true, reveal: false, finished: false, questionStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(liveRooms.id, room.id));
  return { ok: true as const };
}

export async function answerQuestion(code: string, playerId: string, choice: string) {
  const room = await getRoomByCode(code);
  if (!room || room.closed) return { error: "الغرفة غير موجودة أو انتهت المسابقة" as const };
  if (!room.started) return { error: "لم يبدأ المعلم المسابقة بعد" as const };
  if (room.reveal) return { error: "انتهى وقت الإجابة على هذا السؤال" as const };
  const [p] = await db
    .select()
    .from(livePlayers)
    .where(and(eq(livePlayers.roomId, room.id), eq(livePlayers.playerId, playerId)))
    .limit(1);
  if (!p) return { error: "لم تعُد مسجلًا في الغرفة" as const };
  if (p.answered) return { error: "أجبت مسبقًا، بانتظار زملائك" as const };
  await db
    .update(livePlayers)
    .set({ choice: choice.slice(0, 120), answered: true, answeredAt: new Date() })
    .where(eq(livePlayers.id, p.id));
  return { ok: true as const };
}

/** كشف الإجابة ومنح النقاط (10 لكل إجابة صحيحة) */
export async function revealAnswer(code: string) {
  const room = await getRoomByCode(code);
  if (!room) return null;
  const card = (room.deck as LiveQuestion[])[room.currentIndex];
  if (!card) return null;
  await db
    .update(livePlayers)
    .set({ score: sql`${livePlayers.score} + 10` })
    .where(and(eq(livePlayers.roomId, room.id), eq(livePlayers.answered, true), eq(livePlayers.choice, card.correct)));
  await db.update(liveRooms).set({ reveal: true, updatedAt: new Date() }).where(eq(liveRooms.id, room.id));
  return { ok: true as const };
}

export async function nextQuestion(code: string) {
  const room = await getRoomByCode(code);
  if (!room) return { finished: false };
  const deck = room.deck as LiveQuestion[];
  if (room.currentIndex < deck.length - 1) {
    await db
      .update(liveRooms)
      .set({
        reveal: false,
        currentIndex: room.currentIndex + 1,
        questionStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(liveRooms.id, room.id));
    await db.update(livePlayers).set({ answered: false, choice: null }).where(eq(livePlayers.roomId, room.id));
    return { finished: false };
  }
  await db.update(liveRooms).set({ reveal: false, finished: true, updatedAt: new Date() }).where(eq(liveRooms.id, room.id));
  return { finished: true };
}

export async function resetRoom(code: string) {
  const room = await getRoomByCode(code);
  if (!room) return;
  const deck = await buildLiveDeck(room.mode as RoomMode, room.teacherId, { includeBook: true });
  await db
    .update(liveRooms)
    .set({
      deck: deck as unknown[],
      currentIndex: 0,
      reveal: false,
      finished: false,
      started: false,
      seconds: room.seconds,
      questionStartedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(liveRooms.id, room.id));
  await db.update(livePlayers).set({ score: 0, answered: false, choice: null }).where(eq(livePlayers.roomId, room.id));
}

export async function setRoomSeconds(code: string, seconds: number) {
  const room = await getRoomByCode(code);
  if (!room) return;
  await db
    .update(liveRooms)
    .set({
      seconds: Math.max(0, Math.min(300, Math.round(seconds))),
      questionStartedAt: room.reveal ? room.questionStartedAt : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(liveRooms.id, room.id));
}

export async function closeRoom(code: string) {
  await db.update(liveRooms).set({ closed: true, updatedAt: new Date() }).where(eq(liveRooms.code, code));
}

export async function removePlayer(code: string, playerId: string) {
  const room = await getRoomByCode(code);
  if (!room) return;
  await db.delete(livePlayers).where(and(eq(livePlayers.roomId, room.id), eq(livePlayers.playerId, playerId)));
}

/** ينظّف الغرف القديمة (أكثر من 12 ساعة) */
export async function cleanupOldRooms() {
  try {
    await db.execute(sql`delete from live_rooms where created_at < now() - interval '12 hours'`);
  } catch {
    /* تجاهل */
  }
}
