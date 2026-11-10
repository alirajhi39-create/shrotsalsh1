import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import { generateRoomCode } from "@/lib/auth";
import { POINTS_PER_CORRECT, rooms, type Room, type RoomMode, zoneEmoji } from "@/lib/rooms";
import { buildLiveDeck } from "@/lib/live-quiz";
import { ZONE_LABELS } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["create", "close", "next", "reveal", "kick", "reset"]),
  code: z.string().trim().max(8).nullish(),
  mode: z.enum(["conditions", "najasa"]).nullish(),
  playerId: z.string().max(40).nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  includeBook: z.boolean().nullish(),
});

export async function POST(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { action } = parsed.data;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const p = ((body.payload ?? body) ?? {}) as { includeBook?: boolean };

  if (action === "create") {
    // إنشاء غرفة جديدة لا يحتاج رمزًا
    const mode: RoomMode = parsed.data.mode ?? "conditions";
    let code = generateRoomCode();
    let guard = 0;
    while (rooms.has(code) && guard++ < 50) code = generateRoomCode();
    const deck = await buildLiveDeck(mode, session.teacherId, { includeBook: p?.includeBook !== false });
    const room: Room = {
      code,
      teacherId: session.teacherId,
      mode,
      index: 0,
      order: deck as unknown as Room["order"],
      players: new Map(),
      reveal: false,
      createdAt: Date.now(),
      questionAt: Date.now(),
      finished: false,
    };
    rooms.set(code, room);
    const zones = (mode === "conditions" ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"] : ["body", "clothes", "place"]).map((id) => ({ id, label: ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) }));
    return NextResponse.json({ ok: true, code, zones, total: room.order.length, deck: room.order.map((q) => ({ kind: q.kind, label: q.label })) });
  }

  const code = (parsed.data.code ?? "").toString();
  const room = code ? rooms.get(code) : undefined;
  if (!room) return NextResponse.json({ error: "الغرفة غير موجودة أو انتهت" }, { status: 404 });

  if (action === "close") {
    rooms.delete(code);
    return NextResponse.json({ ok: true });
  }
  if (action === "reset") {
    room.order = await buildLiveDeck(room.mode, room.teacherId) as unknown as Room["order"];
    room.index = 0;
    room.reveal = false;
    room.finished = false;
    room.questionAt = Date.now();
    for (const p of room.players.values()) {
      p.score = 0;
      p.answered = false;
      p.choice = null;
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "next") {
    room.reveal = false;
    if (room.index < room.order.length - 1) {
      room.index += 1;
      room.questionAt = Date.now();
      for (const p of room.players.values()) {
        p.answered = false;
        p.choice = null;
      }
    } else {
      room.finished = true;
    }
    return NextResponse.json({ ok: true, finished: room.finished });
  }
  if (action === "reveal") {
    room.reveal = true;
    const card = room.order[room.index];
    for (const p of room.players.values()) {
      if (p.answered && p.choice === card.zone) p.score += POINTS_PER_CORRECT;
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "kick") {
    if (parsed.data.playerId) room.players.delete(parsed.data.playerId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const room = rooms.get(code);
  if (!room) return NextResponse.json({ error: "الغرفة غير موجودة" }, { status: 404 });
  const card = room.order[room.index] ?? null;
  const players = [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, score: p.score, answered: p.answered, choice: room.reveal ? p.choice : null, correct: room.reveal && p.choice === card?.zone, at: p.at }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .map(({ id, name, score, answered, choice, correct }) => ({ id, name, score, answered, choice, correct }));
  return NextResponse.json({
    ok: true,
    code: room.code,
    mode: room.mode,
    index: room.index,
    total: room.order.length,
    card: card
      ? {
          id: card.id,
          label: card.label,
          zone: room.reveal ? card.zone : null,
          correctLabel: room.reveal ? card.zone : null,
          kind: card.kind ?? "classify",
        }
      : null,
    zones: (() => {
      const ids = card
        ? card.kind === "mcq"
          ? (card as { options?: { id: string; label: string }[] }).options?.map((o) => o.id) ?? []
          : room.mode === "conditions"
            ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"]
            : ["body", "clothes", "place"]
        : [];
      return ids.map((id) => ({ id, label: (card.kind === "mcq" ? (card as { options?: { id: string; label: string }[] }).options?.find((o) => o.id === id)?.label : ZONE_LABELS[id]) ?? ZONE_LABELS[id] ?? id, emoji: zoneEmoji(id) }));
    })(),
    players,
    reveal: room.reveal,
    finished: room.finished,
  });
}
