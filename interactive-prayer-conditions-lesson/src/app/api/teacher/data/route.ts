import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioRecordings, auditLogs, classrooms, lessonSlides, questions, teachers } from "@/db/schema";
import { teacherSessionFromRequest } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { loadTeacherData } from "@/lib/teacher-data";
import { listTeacherMedia } from "@/lib/media-server";

export const dynamic = "force-dynamic";

/** كل بيانات لوحة المعلم في استجابة واحدة محمية برمز الجلسة. */
export async function GET(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const base = await loadTeacherData(session.teacherId);
  const [teacher] = await db.select().from(teachers).where(eq(teachers.id, session.teacherId)).limit(1);
  const [qRows, slideRows, audioRows, logs] = await Promise.all([
    db.select().from(questions).where(eq(questions.lessonId, base.lessonId)).orderBy(asc(questions.orderIndex), asc(questions.id)),
    db.select().from(lessonSlides).where(eq(lessonSlides.lessonId, base.lessonId)).orderBy(asc(lessonSlides.orderIndex)),
    db
      .select({ id: audioRecordings.id, title: audioRecordings.title, slideKey: audioRecordings.slideKey, createdAt: audioRecordings.createdAt })
      .from(audioRecordings)
      .where(and(eq(audioRecordings.lessonId, base.lessonId), eq(audioRecordings.kind, "teacher")))
      .orderBy(desc(audioRecordings.createdAt)),
    db.select().from(auditLogs).where(eq(auditLogs.actorType, "student")).orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);
  const roomRows = await db.select().from(classrooms).where(eq(classrooms.teacherId, session.teacherId)).orderBy(asc(classrooms.name));

  return NextResponse.json({
    ok: true,
    teacher: teacher ? { id: teacher.id, name: teacher.name, school: teacher.school } : null,
    lessonId: base.lessonId,
    passPercent: base.passPercent,
    settings: base.settings
      ? {
          passPercent: base.settings.passPercent,
          maxAttempts: base.settings.maxAttempts,
          allowAudio: base.settings.allowAudio,
          soundsEnabled: base.settings.soundsEnabled,
          videoUrl: base.settings.videoUrl,
        }
      : { passPercent: 80, maxAttempts: 2, allowAudio: true, soundsEnabled: true, videoUrl: null },
    rooms: roomRows.map((r) => ({ id: r.id, name: r.name, active: r.active })),
    students: base.students.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null,
    })),
    pendingReviewCount: base.pendingReviewCount,
    questions: qRows.map((q) => ({
      id: q.id,
      slideKey: q.slideKey,
      key: q.key,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      skill: q.skill,
      points: q.points,
      active: q.active,
    })),
    slides: slideRows.map((s) => ({ id: s.id, key: s.key, title: s.title, subtitle: s.subtitle, videoUrl: s.videoUrl })),
    teacherAudios: audioRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    media: await listTeacherMedia(base.lessonId),
    recentLogs: logs.map((l) => ({ id: l.id, actorId: l.actorId, action: l.action, createdAt: l.createdAt.toISOString() })),
  });
}
