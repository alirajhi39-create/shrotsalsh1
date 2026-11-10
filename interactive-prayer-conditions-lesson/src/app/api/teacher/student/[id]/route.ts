import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  audioRecordings,
  certificates,
  classrooms,
  questions,
  quizAttempts,
  studentAnswers,
  studentProgress,
  students,
  teacherSettings,
} from "@/db/schema";
import { teacherSessionFromRequest } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const lessonId = await ensureSeeded();
  const studentId = Number((await ctx.params).id);
  if (!Number.isInteger(studentId)) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });

  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      classroomId: students.classroomId,
      classroom: classrooms.name,
      resumeCode: students.resumeCode,
      locked: students.locked,
      createdAt: students.createdAt,
    })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, session.teacherId)))
    .limit(1);
  if (!student) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });

  const [rooms, settings, progress, answers, attempts, achs, certs, audios, qs] = await Promise.all([
    db.select({ id: classrooms.id, name: classrooms.name, active: classrooms.active }).from(classrooms).where(eq(classrooms.teacherId, session.teacherId)).orderBy(asc(classrooms.name)),
    db.select().from(teacherSettings).where(and(eq(teacherSettings.teacherId, session.teacherId), eq(teacherSettings.lessonId, lessonId))).limit(1),
    db.select().from(studentProgress).where(and(eq(studentProgress.studentId, studentId), eq(studentProgress.lessonId, lessonId))).limit(1),
    db.select().from(studentAnswers).where(and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, lessonId))).orderBy(asc(studentAnswers.createdAt)),
    db.select().from(quizAttempts).where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId))).orderBy(desc(quizAttempts.attemptNumber)),
    db.select().from(achievements).where(and(eq(achievements.studentId, studentId), eq(achievements.lessonId, lessonId))),
    db.select().from(certificates).where(and(eq(certificates.studentId, studentId), eq(certificates.lessonId, lessonId))).limit(1),
    db
      .select({ id: audioRecordings.id, slideKey: audioRecordings.slideKey, title: audioRecordings.title, mimeType: audioRecordings.mimeType, createdAt: audioRecordings.createdAt })
      .from(audioRecordings)
      .where(and(eq(audioRecordings.studentId, studentId), eq(audioRecordings.lessonId, lessonId)))
      .orderBy(desc(audioRecordings.createdAt)),
    db.select().from(questions).where(eq(questions.lessonId, lessonId)),
  ]);

  return NextResponse.json({
    ok: true,
    student: { ...student, createdAt: student.createdAt.toISOString() },
    rooms,
    maxAttempts: settings[0]?.maxAttempts ?? 2,
    allowAudio: settings[0]?.allowAudio ?? true,
    progress: progress[0]
      ? {
          currentSlide: progress[0].currentSlide,
          completedSlides: progress[0].completedSlides,
          points: progress[0].points,
          stars: progress[0].stars,
          extraAttempts: progress[0].extraAttempts,
          completedAt: progress[0].completedAt ? progress[0].completedAt.toISOString() : null,
        }
      : null,
    answers: answers.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(), reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null })),
    attempts: attempts.map((a) => ({ ...a, submittedAt: a.submittedAt.toISOString() })),
    achievements: achs.map((a) => ({ key: a.key, title: a.title, icon: a.icon, earnedAt: a.earnedAt.toISOString() })),
    certificate: certs[0] && !certs[0].revoked ? { ...certs[0], issuedAt: certs[0].issuedAt.toISOString() } : null,
    audios: audios.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    questions: qs.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, options: q.options, answer: q.answer })),
  });
}
