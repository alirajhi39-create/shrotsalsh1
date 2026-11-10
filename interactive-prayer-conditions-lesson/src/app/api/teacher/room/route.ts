import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import {
  answerQuestion,
  closeRoom,
  createRoom,
  getRoomByCode,
  listPlayers,
  nextQuestion,
  removePlayer,
  resetRoom,
  revealAnswer,
  setRoomSeconds,
  startRoom,
} from "@/lib/live-store";
import { ZONE_LABELS, zoneEmoji, type LiveQuestion } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["create", "start", "setSeconds", "close", "next", "reveal", "kick", "reset"]),
  code: z.string().trim().max(8).nullish(),
  mode: z.enum(["conditions", "najasa"]).nullish(),
  playerId: z.string().max(40).nullish(),
  includeBook: z.boolean().nullish(),
  /** مدة السؤال بالثواني (0 = بدون مؤقّت) */
  seconds: z.number().int().min(0).max(300).nullish(),
});

/** الثواني المتبقية للسؤال الحالي (0 إذا كان بلا مؤقّت أو انتهى الوقت) */
function remainingSeconds(room: { seconds: number; reveal: boolean; finished: boolean; questionStartedAt: Date | null }) {
  if (!room.seconds || room.reveal || room.finished || !room.questionStartedAt) return 0;
  const elapsed = Math.floor((Date.now() - new Date(room.questionStartedAt).getTime()) / 1000);
  return Math.max(0, room.seconds - elapsed);
}

function zonesOf(card: LiveQuestion | null, mode: string) {
  if (!card) return [];
  if (card.kind === "mcq") return card.options.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji ?? "🔤" }));
  const ids =
    mode === "conditions" ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"] : ["body", "clothes", "place"];
  return ids.map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) }));
}

export async function POST(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { action } = parsed.data;

  try {
    if (action === "create") {
      const mode = parsed.data.mode ?? "conditions";
      const includeBook = parsed.data.includeBook !== false;
      const seconds = parsed.data.seconds ?? 0;
      const { code, deck } = await createRoom({ teacherId: session.teacherId, mode, includeBook, seconds });
      const zones =
        mode === "conditions" ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"] : ["body", "clothes", "place"];
      return NextResponse.json({
        ok: true,
        code,
        total: deck.length,
        zones: zones.map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) })),
      });
    }

    const code = (parsed.data.code ?? "").toString();
    const room = code ? await getRoomByCode(code) : null;
    if (!room || room.closed) return NextResponse.json({ error: "الغرفة غير موجودة أو انتهت" }, { status: 404 });

    if (action === "start") {
      await startRoom(code);
      return NextResponse.json({ ok: true });
    }
    if (action === "setSeconds") {
      await setRoomSeconds(code, Number(parsed.data.seconds ?? 0));
      return NextResponse.json({ ok: true });
    }
    if (action === "close") {
      await closeRoom(code);
      return NextResponse.json({ ok: true });
    }
    if (action === "reset") {
      await resetRoom(code);
      return NextResponse.json({ ok: true });
    }
    if (action === "next") {
      const r = await nextQuestion(code);
      return NextResponse.json({ ok: true, finished: r.finished });
    }
    if (action === "reveal") {
      await revealAnswer(code);
      return NextResponse.json({ ok: true });
    }
    if (action === "kick") {
      if (parsed.data.playerId) await removePlayer(code, parsed.data.playerId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err) {
    console.error("teacher room error", err);
    return NextResponse.json({ error: "تعذر تنفيذ الطلب" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const room = code ? await getRoomByCode(code) : null;
  if (!room || room.closed) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
  if (room.teacherId !== session.teacherId) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const deck = room.deck as LiveQuestion[];
  const card = deck[room.currentIndex] ?? null;
  const players = (await listPlayers(room.id))
    .map((p) => ({
      id: p.playerId,
      name: p.name,
      score: p.score,
      answered: p.answered,
      choice: room.reveal ? p.choice : null,
      correct: room.reveal && p.choice === card?.correct,
    }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    ok: true,
    code: room.code,
    mode: room.mode,
    index: room.currentIndex,
    total: deck.length,
    card: card
      ? {
          id: card.id,
          label: card.label,
          zone: room.reveal ? card.correct : null,
          kind: card.kind,
          source: card.source,
        }
      : null,
    zones: zonesOf(card, room.mode),
    players,
    reveal: room.reveal,
    finished: room.finished,
    started: room.started,
    seconds: room.seconds,
    remaining: remainingSeconds(room),
  });
}
