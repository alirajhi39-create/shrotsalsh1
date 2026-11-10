import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, certificates, classrooms, quizAttempts, studentAnswers, studentProgress, students, teacherSettings } from "@/db/schema";
import { ensureSeeded } from "./seed";
import { SLIDES } from "./content";

export type StudentRow = {
  id: number;
  name: string;
  classroomId: number;
  classroom: string;
  resumeCode: string;
  locked: boolean;
  createdAt: Date;
  currentSlide: number | null;
  completedSlides: string[];
  completionPct: number;
  points: number;
  stars: number;
  attempts: number;
  bestPercent: number | null;
  pendingReview: boolean;
  certificateSerial: string | null;
  completedAt: Date | null;
  updatedAt: Date | null;
  weakSkills: string[];
};

export async function loadTeacherData(teacherId: number) {
  const lessonId = await ensureSeeded();
  const rooms = await db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId)).orderBy(asc(classrooms.name));
  const roomIds = rooms.map((r) => r.id);
  const [settings] = await db
    .select()
    .from(teacherSettings)
    .where(and(eq(teacherSettings.teacherId, teacherId), eq(teacherSettings.lessonId, lessonId)))
    .limit(1);
  const passPercent = settings?.passPercent ?? 80;

  if (!roomIds.length) {
    return { lessonId, rooms, settings, passPercent, students: [] as StudentRow[], pendingReviewCount: 0, recent: [] };
  }

  const studentRows = await db
    .select({
      id: students.id,
      name: students.name,
      classroomId: students.classroomId,
      classroom: classrooms.name,
      resumeCode: students.resumeCode,
      locked: students.locked,
      createdAt: students.createdAt,
      currentSlide: studentProgress.currentSlide,
      completedSlides: studentProgress.completedSlides,
      points: studentProgress.points,
      stars: studentProgress.stars,
      completedAt: studentProgress.completedAt,
      updatedAt: studentProgress.updatedAt,
    })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .leftJoin(studentProgress, and(eq(studentProgress.studentId, students.id), eq(studentProgress.lessonId, lessonId)))
    .where(inArray(students.classroomId, roomIds))
    .orderBy(asc(classrooms.name), asc(students.name));

  const ids = studentRows.map((s) => s.id);
  const [attempts, certs, pending, recent] = ids.length
    ? await Promise.all([
        db.select().from(quizAttempts).where(and(eq(quizAttempts.lessonId, lessonId), inArray(quizAttempts.studentId, ids))),
        db.select().from(certificates).where(and(eq(certificates.lessonId, lessonId), eq(certificates.revoked, false), inArray(certificates.studentId, ids))),
        db
          .select({ studentId: studentAnswers.studentId })
          .from(studentAnswers)
          .where(and(eq(studentAnswers.lessonId, lessonId), eq(studentAnswers.needsReview, true), isNull(studentAnswers.teacherScore), inArray(studentAnswers.studentId, ids))),
        db.select().from(auditLogs).where(eq(auditLogs.actorType, "student")).orderBy(desc(auditLogs.createdAt)).limit(12),
      ])
    : [[], [], [], []];

  const result: StudentRow[] = studentRows.map((s) => {
    const mine = attempts.filter((a) => a.studentId === s.id);
    const best = mine.length ? mine.reduce((m, a) => (a.percent > m.percent ? a : m)) : null;
    const weak: string[] = [];
    if (best) {
      for (const [skill, v] of Object.entries(best.skillReport)) {
        if (v.max && (v.earned / v.max) * 100 < 60) weak.push(skill);
      }
    }
    const completed = s.completedSlides ?? [];
    return {
      id: s.id,
      name: s.name,
      classroomId: s.classroomId,
      classroom: s.classroom,
      resumeCode: s.resumeCode,
      locked: s.locked,
      createdAt: s.createdAt,
      currentSlide: s.currentSlide,
      completedSlides: completed,
      completionPct: Math.round((completed.length / SLIDES.length) * 100),
      points: s.points ?? 0,
      stars: s.stars ?? 0,
      attempts: mine.length,
      bestPercent: best ? best.percent : null,
      pendingReview: mine.some((a) => a.pendingReview) || pending.some((p) => p.studentId === s.id),
      certificateSerial: certs.find((c) => c.studentId === s.id)?.serial ?? null,
      completedAt: s.completedAt ?? null,
      updatedAt: s.updatedAt ?? null,
      weakSkills: weak,
    };
  });

  return { lessonId, rooms, settings, passPercent, students: result, pendingReviewCount: pending.length, recent };
}

export function isStruggling(s: StudentRow, passPercent: number) {
  if (s.bestPercent !== null && s.bestPercent < passPercent) return true;
  if (s.weakSkills.length > 0) return true;
  if (s.updatedAt && !s.completedAt && s.completionPct < 50 && Date.now() - new Date(s.updatedAt).getTime() > 7 * 24 * 3600 * 1000) return true;
  return false;
}
