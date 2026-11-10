import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import { LiveQuizError, createLiveRoom, listLiveRooms } from "@/lib/live-quiz-server";

export const dynamic = "force-dynamic";
const schema = z.object({
  mode: z.enum(["mixed", "assessment", "conditions", "najasa"]).default("mixed"),
  questionSeconds: z.number().int().min(10).max(120).default(30),
  questionCount: z.number().int().min(1).max(100).optional(),
  timerEnabled: z.boolean().default(true),
  autoReveal: z.boolean().default(true),
  questionIds: z.array(z.string().min(1).max(120)).min(1).max(100).optional(),
});
export async function GET(req: NextRequest) {
  const t = await teacherSessionFromRequest(req);
  if (!t) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return NextResponse.json({ ok: true, rooms: await listLiveRooms(t.teacherId) });
}
export async function POST(req: NextRequest) {
  const t = await teacherSessionFromRequest(req);
  if (!t) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "إعدادات المسابقة غير صالحة" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, state: await createLiveRoom(t.teacherId, p.data) });
  } catch (e) {
    if (e instanceof LiveQuizError) return NextResponse.json({ error: e.message }, { status: e.status });
    const ref = randomUUID().slice(0, 8);
    console.error("live_quiz_create_failed", { ref, teacherId: t.teacherId, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: `تعذر إنشاء الغرفة الآن. أعد المحاولة؛ وإن استمر الخطأ أرسل رمز المتابعة: ${ref}`, ref }, { status: 500 });
  }
}
