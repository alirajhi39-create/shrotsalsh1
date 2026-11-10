import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeeded } from "@/lib/seed";
import { buildStudentState, getSettings, getStudentFromCookie, submitQuiz } from "@/lib/student";

export const dynamic = "force-dynamic";

const schema = z.object({
  answers: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).max(80),
});

export async function POST(req: NextRequest) {
  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "انتهت الجلسة، سجّل الدخول من جديد" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  try {
    const lessonId = await ensureSeeded();
    const settings = await getSettings(student.teacherId, lessonId);
    const { attempt } = await submitQuiz(student, lessonId, settings, parsed.data.answers, parsed.data.idempotencyKey);
    const state = await buildStudentState(student);
    const view = state.attempts.find((a) => a.id === attempt.id) ?? null;
    return NextResponse.json({ ok: true, attempt: view, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إرسال الاختبار";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
