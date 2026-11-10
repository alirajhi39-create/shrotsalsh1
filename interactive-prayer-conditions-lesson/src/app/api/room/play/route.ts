import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion, getRoomByCode, joinRoom, listPlayers, removePlayer } from "@/lib/live-store";
import { ZONE_LABELS, zoneEmoji, type LiveQuestion } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const joinSchema = z.object({ code: z.string().trim().min(3).max(8), name: z.string().trim().min(2).max(40) });
const playSchema = z.object({
  code: z.string().trim().min(3).max(8),
  playerId: z.string().min(3).max(40),
  action: z.enum(["answer", "leave"]),
  choice: z.string().max(120).optional(),
});

function zonesOf(card: LiveQuestion | null, mode: string) {
  if (!card) return [];
  if (card.kind === "mcq") return card.options.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji ?? "🔤" }));
  const ids = mode === "conditions" ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"] : ["body", "clothes", "place"];
  return ids.map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) }));
}

export async function PUT(req: NextRequest) {
  const parsed = joinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  try {
    const res = await joinRoom(parsed.data.code, parsed.data.name.replace(/\s+/g, " ").trim());
    if (!res) return NextResponse.json({ error: "رمز الغرفة غير صحيح أو انتهت المسابقة" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      playerId: res.playerId,
      index: res.room.currentIndex,
      total: (res.room.deck as LiveQuestion[]).length,
    });
  } catch (err) {
    console.error("join error", err);
    return NextResponse.json({ error: "تعذر الانضمام" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const parsed = playSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { code, playerId, action } = parsed.data;
  try {
    if (action === "answer") {
      const r = await answerQuestion(code, playerId, parsed.data.choice ?? "");
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, waiting: true });
    }
    // leave: نجيب اللاعب بنفسه إن أراد الخروج
    const room = await getRoomByCode(code);
    if (room) await removePlayer(code, playerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("play error", err);
    return NextResponse.json({ error: "تعذر تنفيذ الطلب" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const playerId = req.nextUrl.searchParams.get("playerId") ?? "";
  try {
    const room = await getRoomByCode(code);
    if (!room || room.closed) return NextResponse.json({ error: "انتهت المسابقة" }, { status: 404 });
    const deck = room.deck as LiveQuestion[];
    const card = deck[room.currentIndex] ?? null;
    const players = await listPlayers(room.id);
    const me = players.find((p) => p.playerId === playerId) ?? null;
    const answeredCount = players.filter((p) => p.answered).length;
    const leaderboard = room.reveal
      ? [...players]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }))
      : [];

    return NextResponse.json({
      ok: true,
      code: room.code,
      index: room.currentIndex,
      total: deck.length,
      finished: room.finished,
      started: room.started,
      seconds: room.seconds,
      remaining: (() => {
        if (!room.seconds || room.reveal || room.finished || !room.questionStartedAt) return 0;
        const elapsed = Math.floor((Date.now() - new Date(room.questionStartedAt).getTime()) / 1000);
        return Math.max(0, room.seconds - elapsed);
      })(),
      reveal: room.reveal,
      question: card && room.started ? { label: card.label, kind: card.kind } : null,
      zones: zonesOf(card, room.mode),
      me: me
        ? { name: me.name, score: me.score, answered: me.answered, choice: me.choice, correct: room.reveal && me.choice === card?.correct }
        : null,
      answeredCount,
      totalPlayers: players.length,
      correctZone: room.reveal ? card?.correct ?? null : null,
      leaderboard,
    });
  } catch (err) {
    console.error("play state error", err);
    return NextResponse.json({ error: "تعذر تحميل الحالة" }, { status: 500 });
  }
}
