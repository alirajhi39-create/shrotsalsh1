import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/auth";
import { rooms, ZONE_LABELS, zoneEmoji } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const joinSchema = z.object({ code: z.string().trim().min(3).max(8), name: z.string().trim().min(2).max(40) });
const playSchema = z.object({
  code: z.string().trim().min(3).max(8),
  playerId: z.string().min(6).max(40),
  action: z.enum(["state", "answer", "leave"]),
  choice: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = playSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { code, playerId, action } = parsed.data;
  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "الغرفة غير موجودة أو انتهت المسابقة" }, { status: 404 });

  if (action === "answer") {
    const p = room.players.get(playerId);
    if (!p) return NextResponse.json({ error: "لم تعُد مسجلًا في الغرفة" }, { status: 403 });
    if (room.reveal) return NextResponse.json({ error: "انتهى وقت الإجابة على هذا السؤال" }, { status: 400 });
    if (p.answered) return NextResponse.json({ error: "أجبت مسبقًا، بانتظار زملائك" }, { status: 400 });
    p.choice = parsed.data.choice ?? "";
    p.answered = true;
    p.at = Date.now();
    return NextResponse.json({ ok: true, waiting: true });
  }

  if (action === "leave") {
    room.players.delete(playerId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}

/** انضمام طالب بالاسم + رمز الغرفة: يُنشئ هوية مؤقتة للمسابقة فقط */
export async function PUT(req: NextRequest) {
  const parsed = joinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const room = rooms.get(parsed.data.code);
  if (!room) return NextResponse.json({ error: "رمز الغرفة غير صحيح أو انتهت المسابقة" }, { status: 404 });

  const name = parsed.data.name.replace(/\s+/g, " ").trim();
  const playerId = hashToken(`${room.code}:${name}:${Date.now()}`).slice(0, 24);
  const existing = [...room.players.values()].find((p) => p.name === name);
  if (existing) {
    // نفس الطالب أعاد الانضمام: نحافظ على نقطته
    return NextResponse.json({ ok: true, playerId: existing.id, name: existing.name, index: room.index, total: room.order.length });
  }
  room.players.set(playerId, { id: playerId, name, score: 0, answered: false, choice: null, at: Date.now() });
  return NextResponse.json({ ok: true, playerId, name, index: room.index, total: room.order.length });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const playerId = req.nextUrl.searchParams.get("playerId") ?? "";
  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "الغرفة غير موجودة أو انتهت المسابقة" }, { status: 404 });
  const me = room.players.get(playerId) ?? null;
  const card = room.order[room.index] ?? null;
  const answeredCount = [...room.players.values()].filter((p) => p.answered).length;
  return NextResponse.json({
    ok: true,
    code: room.code,
    index: room.index,
    total: room.order.length,
    finished: room.finished,
    reveal: room.reveal,
    question: card
      ? {
          label: card.label,
          kind: card.kind ?? "classify",
          options:
            card.kind === "mcq"
              ? (card.options ?? []).map((o) => ({ id: o.id, label: o.label, emoji: o.emoji }))
              : (room.mode === "conditions"
                  ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"]
                  : ["body", "clothes", "place"]
                ).map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) })),
        }
      : null,
    zones: card
      ? card.kind === "mcq"
        ? (card.options ?? []).map((o) => ({ id: o.id, label: o.label, emoji: o.emoji ?? "🔤" }))
        : (room.mode === "conditions"
            ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"]
            : ["body", "clothes", "place"]
          ).map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) }))
      : [],
    me: me ? { name: me.name, score: me.score, answered: me.answered, choice: me.choice, correct: room.reveal && me.choice === card?.zone } : null,
    answeredCount,
    totalPlayers: room.players.size,
    correctZone: room.reveal ? card?.zone ?? null : null,
    leaderboard: room.reveal
      ? [...room.players.values()].sort((a, b) => b.score - a.score).slice(0, 10).map((x, i) => ({ rank: i + 1, name: x.name, score: x.score }))
      : [],
  });
}
