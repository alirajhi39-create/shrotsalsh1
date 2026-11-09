import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioRecordings, studentAnswers, studentProgress, quizAttempts } from "@/db/schema";
import { ACTIVITIES, SLIDES } from "@/lib/content";
import { ensureSeeded } from "@/lib/seed";
import {
  buildStudentState,
  ensureProgress,
  getActiveQuestions,
  getSettings,
  getStudentFromCookie,
  logAudit,
  saveActivityAnswer,
  saveQuestionAnswer,
} from "@/lib/student";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BASE64 = 2_800_000; // ≈ 2 ميغابايت

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    currentSlide: z.number().int().min(0).max(SLIDES.length - 1),
    completeSlide: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal("answer"),
    activityKey: z.string().max(64),
    answer: z.unknown(),
    idempotencyKey: z.string().min(8).max(80),
  }),
  z.object({
    type: z.literal("question"),
    questionId: z.number().int().positive(),
    response: z.unknown(),
    idempotencyKey: z.string().min(8).max(80),
  }),
  z.object({
    type: z.literal("audio"),
    slideKey: z.string().max(64),
    activityKey: z.string().max(64).optional(),
    mimeType: z.string().max(64),
    dataBase64: z.string().min(16).max(MAX_AUDIO_BASE64),
    durationMs: z.number().int().min(0).max(10 * 60 * 1000),
    idempotencyKey: z.string().min(8).max(80),
  }),
]);

async function slideRequirementsMet(studentId: number, lessonId: number, slideKey: string) {
  const required = Object.entries(ACTIVITIES)
    .filter(([, a]) => a.slideKey === slideKey && a.required)
    .map(([k]) => k);
  const rows = await db
    .select({ activityKey: studentAnswers.activityKey })
    .from(studentAnswers)
    .where(
      and(
        eq(studentAnswers.studentId, studentId),
        eq(studentAnswers.lessonId, lessonId),
        eq(studentAnswers.slideKey, slideKey),
        eq(studentAnswers.attemptId, 0),
      ),
    );
  const have = new Set(rows.map((r) => r.activityKey));
  if (required.some((k) => !have.has(k))) return false;
  if (slideKey === "book") {
    const qs = await getActiveQuestions(lessonId, "book");
    if (qs.some((q) => !have.has(`q_${q.id}`))) return false;
  }
  if (slideKey === "quiz") {
    const attempts = await db
      .select({ id: quizAttempts.id })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))
      .limit(1);
    if (!attempts.length) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "انتهت الجلسة، سجّل الدخول من جديد" }, { status: 401 });
  const lessonId = await ensureSeeded();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.type === "progress") {
      const progress = await ensureProgress(student.id, lessonId);
      let completed = progress.completedSlides;
      if (body.completeSlide && !completed.includes(body.completeSlide)) {
        if (!SLIDES.some((s) => s.key === body.completeSlide)) {
          return NextResponse.json({ error: "محطة غير معروفة" }, { status: 400 });
        }
        const ok = await slideRequirementsMet(student.id, lessonId, body.completeSlide);
        if (!ok) return NextResponse.json({ error: "أكمل أنشطة المحطة أولًا" }, { status: 400 });
        completed = [...completed, body.completeSlide];
      }
      await db
        .update(studentProgress)
        .set({
          currentSlide: Math.max(body.currentSlide, 0),
          completedSlides: completed,
          updatedAt: new Date(),
        })
        .where(eq(studentProgress.id, progress.id));
      const state = await buildStudentState(student);
      return NextResponse.json({ ok: true, state });
    }

    if (body.type === "answer") {
      if (!ACTIVITIES[body.activityKey]) return NextResponse.json({ error: "نشاط غير معروف" }, { status: 400 });
      const { result, newAchievements } = await saveActivityAnswer(
        student,
        lessonId,
        body.activityKey,
        body.answer ?? {},
        body.idempotencyKey,
      );
      const state = await buildStudentState(student);
      return NextResponse.json({ ok: true, result, newAchievements, state });
    }

    if (body.type === "question") {
      const { result, explanation } = await saveQuestionAnswer(
        student,
        lessonId,
        body.questionId,
        body.response ?? {},
        body.idempotencyKey,
      );
      const state = await buildStudentState(student);
      return NextResponse.json({ ok: true, result, explanation, state });
    }

    if (body.type === "audio") {
      const settings = await getSettings(student.teacherId, lessonId);
      if (!settings.allowAudio) return NextResponse.json({ error: "التسجيل الصوتي غير مفعّل من المعلم" }, { status: 403 });
      if (!/^audio\//.test(body.mimeType)) return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
      const [rec] = await db
        .insert(audioRecordings)
        .values({
          studentId: student.id,
          lessonId,
          slideKey: body.slideKey,
          kind: "student",
          title: body.activityKey ?? "",
          mimeType: body.mimeType,
          dataBase64: body.dataBase64,
          durationMs: body.durationMs,
        })
        .returning({ id: audioRecordings.id });
      if (body.activityKey && ACTIVITIES[body.activityKey]) {
        await saveActivityAnswer(student, lessonId, body.activityKey, { audio: true, recordingId: rec.id }, body.idempotencyKey);
      }
      await logAudit("student", student.id, "audio_uploaded", "audio_recordings", rec.id, { slideKey: body.slideKey });
      const state = await buildStudentState(student);
      return NextResponse.json({ ok: true, recordingId: rec.id, state });
    }

    return NextResponse.json({ error: "نوع غير مدعوم" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
