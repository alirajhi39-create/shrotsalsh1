import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  audioRecordings,
  certificates,
  classrooms,
  lessonSlides,
  questions,
  quizAttempts,
  studentAnswers,
  studentProgress,
  studentSessions,
  students,
  teacherSettings,
  teachers,
  mediaAssets,
} from "@/db/schema";
import { generateResumeCode, hashPassword, teacherSessionFromRequest, verifyPassword } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { AUDIO_SLOTS, IMAGE_SLOTS } from "@/lib/media-catalog";
import { bestAttemptPercent, issueCertificate, logAudit, recomputeAttempt, recomputeProgress } from "@/lib/student";

export const dynamic = "force-dynamic";

const payload = z.record(z.string(), z.unknown());
const schema = z.object({ action: z.string().min(2).max(40), payload });

const s = (p: Record<string, unknown>, k: string) => String(p[k] ?? "").trim();
const n = (p: Record<string, unknown>, k: string, d = 0) => {
  const v = Number(p[k]);
  return Number.isFinite(v) ? v : d;
};
const b = (p: Record<string, unknown>, k: string) => p[k] === true || p[k] === "true" || p[k] === "on" || p[k] === 1;

async function ownedStudent(teacherId: number, id: number) {
  const [row] = await db
    .select({ id: students.id, name: students.name, classroomId: students.classroomId, classroomName: classrooms.name, locked: students.locked })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, id), eq(classrooms.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

async function ownedClassroom(teacherId: number, id: number) {
  const [c] = await db.select().from(classrooms).where(and(eq(classrooms.id, id), eq(classrooms.teacherId, teacherId))).limit(1);
  return c ?? null;
}

export async function POST(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح، سجّل الدخول من جديد" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const { action } = parsed.data;
  const p = parsed.data.payload as Record<string, unknown>;
  const tid = session.teacherId;

  try {
    const lessonId = await ensureSeeded();

    /* ---------------- الفصول ---------------- */
    if (action === "addClassroom") {
      const name = s(p, "name");
      if (name.length < 2) return NextResponse.json({ error: "اسم الفصل قصير" }, { status: 400 });
      const [row] = await db.insert(classrooms).values({ teacherId: tid, name }).onConflictDoNothing().returning();
      if (!row) return NextResponse.json({ error: "الفصل موجود مسبقًا" }, { status: 409 });
      await logAudit("teacher", tid, "classroom_added", "classrooms", row.id, { name });
      return NextResponse.json({ ok: true, msg: `تمت إضافة فصل ${name}` });
    }
    if (action === "toggleClassroom") {
      const c = await ownedClassroom(tid, n(p, "id"));
      if (!c) return NextResponse.json({ error: "الفصل غير موجود" }, { status: 404 });
      await db.update(classrooms).set({ active: !c.active }).where(eq(classrooms.id, c.id));
      await logAudit("teacher", tid, "classroom_toggled", "classrooms", c.id, { active: !c.active });
      return NextResponse.json({ ok: true, msg: c.active ? "تم إيقاف الفصل" : "تم تفعيل الفصل" });
    }
    if (action === "deleteClassroom") {
      const c = await ownedClassroom(tid, n(p, "id"));
      if (!c) return NextResponse.json({ error: "الفصل غير موجود" }, { status: 404 });
      const [st] = await db.select({ id: students.id }).from(students).where(eq(students.classroomId, c.id)).limit(1);
      if (st) return NextResponse.json({ error: "لا يمكن حذف فصل فيه طلاب؛ انقل الطلاب أولًا" }, { status: 400 });
      await db.delete(classrooms).where(eq(classrooms.id, c.id));
      await logAudit("teacher", tid, "classroom_deleted", "classrooms", c.id, { name: c.name });
      return NextResponse.json({ ok: true, msg: "تم حذف الفصل" });
    }

    /* ---------------- الطلاب ---------------- */
    if (action === "addStudent") {
      const name = s(p, "name").replace(/\s+/g, " ");
      const classroomId = n(p, "classroomId");
      if (name.length < 2) return NextResponse.json({ error: "اسم الطالب قصير" }, { status: 400 });
      if (!(await ownedClassroom(tid, classroomId))) return NextResponse.json({ error: "الفصل غير صالح" }, { status: 400 });
      const [row] = await db
        .insert(students)
        .values({ classroomId, name, resumeCode: generateResumeCode(), locked: true })
        .onConflictDoNothing()
        .returning();
      if (!row) return NextResponse.json({ error: "الطالب مسجل مسبقًا في هذا الفصل" }, { status: 409 });
      await db.insert(studentProgress).values({ studentId: row.id, lessonId }).onConflictDoNothing();
      await logAudit("teacher", tid, "student_added", "students", row.id, { name });
      return NextResponse.json({ ok: true, msg: `تمت إضافة ${name} — رمز الاستكمال: ${row.resumeCode}` });
    }
    if (action === "updateStudent") {
      const id = n(p, "id");
      const st = await ownedStudent(tid, id);
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      const name = s(p, "name").replace(/\s+/g, " ");
      const classroomId = n(p, "classroomId", st.classroomId);
      if (name.length < 2) return NextResponse.json({ error: "اسم الطالب قصير" }, { status: 400 });
      if (!(await ownedClassroom(tid, classroomId))) return NextResponse.json({ error: "الفصل غير صالح" }, { status: 400 });
      try {
        await db.update(students).set({ name, classroomId, locked: b(p, "locked") }).where(eq(students.id, id));
      } catch {
        return NextResponse.json({ error: "يوجد طالب آخر بنفس الاسم في هذا الفصل" }, { status: 409 });
      }
      await logAudit("teacher", tid, "student_updated", "students", id, { name });
      return NextResponse.json({ ok: true, msg: "تم حفظ بيانات الطالب" });
    }
    if (action === "deleteStudent") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      await db.delete(students).where(eq(students.id, st.id));
      await logAudit("teacher", tid, "student_deleted", "students", st.id, { name: st.name });
      return NextResponse.json({ ok: true, msg: `تم حذف ${st.name} وجميع بياناته` });
    }
    if (action === "resetProgress") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      await db.delete(studentAnswers).where(and(eq(studentAnswers.studentId, st.id), eq(studentAnswers.lessonId, lessonId)));
      await db.delete(quizAttempts).where(and(eq(quizAttempts.studentId, st.id), eq(quizAttempts.lessonId, lessonId)));
      await db.delete(achievements).where(and(eq(achievements.studentId, st.id), eq(achievements.lessonId, lessonId)));
      await db.delete(certificates).where(and(eq(certificates.studentId, st.id), eq(certificates.lessonId, lessonId)));
      await db.delete(audioRecordings).where(and(eq(audioRecordings.studentId, st.id), eq(audioRecordings.lessonId, lessonId)));
      await db
        .update(studentProgress)
        .set({ currentSlide: 0, completedSlides: [], points: 0, stars: 0, extraAttempts: 0, completedAt: null, updatedAt: new Date() })
        .where(and(eq(studentProgress.studentId, st.id), eq(studentProgress.lessonId, lessonId)));
      await logAudit("teacher", tid, "student_reset", "students", st.id);
      return NextResponse.json({ ok: true, msg: "تمت إعادة تعيين تقدم الطالب" });
    }
    if (action === "regenerateCode") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      const code = generateResumeCode();
      await db.update(students).set({ resumeCode: code }).where(eq(students.id, st.id));
      await db.update(studentSessions).set({ revoked: true }).where(eq(studentSessions.studentId, st.id));
      await logAudit("teacher", tid, "resume_code_regenerated", "students", st.id);
      return NextResponse.json({ ok: true, msg: `رمز الاستكمال الجديد: ${code} (أُنهيت الجلسات السابقة)` });
    }
    if (action === "grantExtraAttempt") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      const [prog] = await db.select().from(studentProgress).where(and(eq(studentProgress.studentId, st.id), eq(studentProgress.lessonId, lessonId))).limit(1);
      if (prog) await db.update(studentProgress).set({ extraAttempts: prog.extraAttempts + 1 }).where(eq(studentProgress.id, prog.id));
      else await db.insert(studentProgress).values({ studentId: st.id, lessonId, extraAttempts: 1 });
      await logAudit("teacher", tid, "extra_attempt_granted", "students", st.id);
      return NextResponse.json({ ok: true, msg: "تم السماح بمحاولة إضافية" });
    }

    /* ---------------- التصحيح والشهادات ---------------- */
    if (action === "gradeAnswer") {
      const id = n(p, "answerId");
      const [a] = await db.select().from(studentAnswers).where(eq(studentAnswers.id, id)).limit(1);
      if (!a) return NextResponse.json({ error: "الإجابة غير موجودة" }, { status: 404 });
      if (!(await ownedStudent(tid, a.studentId))) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      const score = Math.max(0, Math.min(a.maxScore, Math.round(n(p, "score"))));
      const feedback = s(p, "feedback").slice(0, 500);
      await db
        .update(studentAnswers)
        .set({ teacherScore: score, teacherFeedback: feedback || null, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(studentAnswers.id, id));
      if (a.attemptId !== 0) {
        const [at] = await db
          .select({ id: quizAttempts.id })
          .from(quizAttempts)
          .where(and(eq(quizAttempts.studentId, a.studentId), eq(quizAttempts.lessonId, a.lessonId), eq(quizAttempts.attemptNumber, a.attemptId)))
          .limit(1);
        if (at) await recomputeAttempt(at.id);
      } else await recomputeProgress(a.studentId, a.lessonId);
      await logAudit("teacher", tid, "answer_graded", "student_answers", id, { score });
      return NextResponse.json({ ok: true, msg: "تم حفظ التصحيح" });
    }
    if (action === "issueCertificate") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      const best = (await bestAttemptPercent(st.id, lessonId)) ?? 0;
      await issueCertificate({ id: st.id, name: st.name, classroomName: st.classroomName }, lessonId, best, "teacher");
      return NextResponse.json({ ok: true, msg: "تم إصدار الشهادة" });
    }
    if (action === "revokeCertificate") {
      const st = await ownedStudent(tid, n(p, "id"));
      if (!st) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 });
      await db.update(certificates).set({ revoked: true }).where(and(eq(certificates.studentId, st.id), eq(certificates.lessonId, lessonId)));
      await logAudit("teacher", tid, "certificate_revoked", "certificates", null, { studentId: st.id });
      return NextResponse.json({ ok: true, msg: "تم إلغاء الشهادة" });
    }

    /* ---------------- الإعدادات ---------------- */
    if (action === "updateSettings") {
      const passPercent = Math.round(n(p, "passPercent", 80));
      const maxAttempts = Math.round(n(p, "maxAttempts", 2));
      const videoUrl = s(p, "videoUrl");
      if (passPercent < 50 || passPercent > 100 || maxAttempts < 1 || maxAttempts > 10)
        return NextResponse.json({ error: "قيم غير صالحة (النسبة 50–100، المحاولات 1–10)" }, { status: 400 });
      if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return NextResponse.json({ error: "رابط الفيديو غير صالح" }, { status: 400 });
      const values = {
        passPercent,
        maxAttempts,
        allowAudio: b(p, "allowAudio"),
        soundsEnabled: b(p, "soundsEnabled"),
        videoUrl: videoUrl || null,
      };
      await db
        .insert(teacherSettings)
        .values({ teacherId: tid, lessonId, ...values })
        .onConflictDoUpdate({ target: [teacherSettings.teacherId, teacherSettings.lessonId], set: { ...values, updatedAt: new Date() } });
      await logAudit("teacher", tid, "settings_updated", "teacher_settings", null, values as Record<string, unknown>);
      return NextResponse.json({ ok: true, msg: "تم حفظ الإعدادات" });
    }
    if (action === "updateSlide") {
      const id = n(p, "id");
      const title = s(p, "title");
      const videoUrl = s(p, "videoUrl");
      if (title.length < 2 || (videoUrl && !/^https?:\/\//i.test(videoUrl)))
        return NextResponse.json({ error: "بيانات المحطة غير صالحة" }, { status: 400 });
      const [slide] = await db.select().from(lessonSlides).where(and(eq(lessonSlides.id, id), eq(lessonSlides.lessonId, lessonId))).limit(1);
      if (!slide) return NextResponse.json({ error: "المحطة غير موجودة" }, { status: 404 });
      await db.update(lessonSlides).set({ title, subtitle: s(p, "subtitle"), videoUrl: videoUrl || null }).where(eq(lessonSlides.id, id));
      await logAudit("teacher", tid, "slide_updated", "lesson_slides", id, { title });
      return NextResponse.json({ ok: true, msg: "تم تحديث المحطة" });
    }
    if (action === "changePassword") {
      const current = s(p, "current");
      const next = s(p, "next");
      if (next.length < 6) return NextResponse.json({ error: "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف" }, { status: 400 });
      const [t] = await db.select().from(teachers).where(eq(teachers.id, tid)).limit(1);
      if (!t || !verifyPassword(current, t.passwordHash)) return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 403 });
      await db.update(teachers).set({ passwordHash: hashPassword(next) }).where(eq(teachers.id, tid));
      await logAudit("teacher", tid, "password_changed", "teachers", tid);
      return NextResponse.json({ ok: true, msg: "تم تغيير كلمة المرور" });
    }
    if (action === "uploadTeacherAudio") {
      const title = s(p, "title") || "تسجيل المعلم";
      const slideKey = s(p, "slideKey") || "general";
      const mimeType = s(p, "mimeType");
      const dataBase64 = s(p, "dataBase64");
      if (!mimeType.startsWith("audio/") || dataBase64.length < 16 || dataBase64.length > 4_200_000)
        return NextResponse.json({ error: "الملف الصوتي غير صالح أو يتجاوز 3 ميغابايت" }, { status: 400 });
      const [row] = await db
        .insert(audioRecordings)
        .values({ studentId: null, lessonId, slideKey, kind: "teacher", title, mimeType, dataBase64, durationMs: 0 })
        .returning({ id: audioRecordings.id });
      await logAudit("teacher", tid, "teacher_audio_uploaded", "audio_recordings", row.id, { title });
      return NextResponse.json({ ok: true, msg: "تم رفع الملف الصوتي" });
    }
    if (action === "deleteTeacherAudio") {
      const id = n(p, "id");
      await db.delete(audioRecordings).where(and(eq(audioRecordings.id, id), eq(audioRecordings.kind, "teacher")));
      await logAudit("teacher", tid, "teacher_audio_deleted", "audio_recordings", id);
      return NextResponse.json({ ok: true, msg: "تم حذف الملف الصوتي" });
    }

    /* ---------------- الأسئلة ---------------- */
    if (action === "saveQuestion") {
      const qSchema = z.object({
        id: z.number().int().positive().optional(),
        slideKey: z.enum(["quiz", "book"]),
        kind: z.string().min(2).max(32),
        prompt: z.string().trim().min(3).max(2000),
        options: z.record(z.string(), z.unknown()),
        answer: z.record(z.string(), z.unknown()),
        explanation: z.string().max(1000).optional().default(""),
        skill: z.string().max(100).optional().default(""),
        points: z.number().int().min(1).max(10),
        active: z.boolean(),
      });
      const q = qSchema.safeParse(p.question);
      if (!q.success) return NextResponse.json({ error: "بيانات السؤال غير مكتملة" }, { status: 400 });
      const d = q.data;
      if (d.id) {
        await db
          .update(questions)
          .set({ slideKey: d.slideKey, kind: d.kind, prompt: d.prompt, options: d.options, answer: d.answer, explanation: d.explanation, skill: d.skill, points: d.points, active: d.active, updatedAt: new Date() })
          .where(and(eq(questions.id, d.id), eq(questions.lessonId, lessonId)));
        await logAudit("teacher", tid, "question_updated", "questions", d.id);
      } else {
        const [row] = await db
          .insert(questions)
          .values({ lessonId, key: `custom_${Date.now().toString(36)}`, slideKey: d.slideKey, kind: d.kind, prompt: d.prompt, options: d.options, answer: d.answer, explanation: d.explanation, skill: d.skill, points: d.points, active: d.active, orderIndex: 1000 })
          .returning();
        await logAudit("teacher", tid, "question_added", "questions", row.id);
      }
      return NextResponse.json({ ok: true, msg: "تم حفظ السؤال" });
    }
    if (action === "toggleQuestion") {
      const id = n(p, "id");
      const [q] = await db.select().from(questions).where(and(eq(questions.id, id), eq(questions.lessonId, lessonId))).limit(1);
      if (!q) return NextResponse.json({ error: "السؤال غير موجود" }, { status: 404 });
      await db.update(questions).set({ active: !q.active, updatedAt: new Date() }).where(eq(questions.id, id));
      await logAudit("teacher", tid, "question_toggled", "questions", id, { active: !q.active });
      return NextResponse.json({ ok: true, msg: q.active ? "تم تعطيل السؤال" : "تم تفعيل السؤال" });
    }

    /* ---------------- مكتبة الوسائط (صور وأصوات لكل الأجهزة) ---------------- */
    if (action === "saveMedia") {
      const slot = s(p, "slot");
      const kind = s(p, "kind") === "audio" ? "audio" : "image";
      const mime = s(p, "mime");
      let dataUrl = s(p, "dataUrl");
      const title = s(p, "title").slice(0, 120);
      const altText = s(p, "altText").slice(0, 160);
      const known = kind === "audio" ? AUDIO_SLOTS.find((x) => x.key === slot) : IMAGE_SLOTS.find((x) => x.key === slot);
      if (!known) return NextResponse.json({ error: "موضع وسائط غير معروف" }, { status: 400 });
      const maxBytes = kind === "audio" ? 3_500_000 : 1_200_000;
      if (!dataUrl) return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
      // يقبل رابط بيانات كاملًا أو base64 خام
      if (!/^data:[\w./+-]+;base64,/.test(dataUrl)) dataUrl = `data:${mime || "application/octet-stream"};base64,${dataUrl}`;
      const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
      if (bytes > maxBytes) return NextResponse.json({ error: `حجم الملف يتجاوز ${Math.round(maxBytes / 1024 / 1024)} ميغابايت` }, { status: 400 });
      if (kind === "image" && !/^data:image\//.test(dataUrl)) return NextResponse.json({ error: "الملف ليس صورة" }, { status: 400 });
      if (kind === "audio" && !/^data:audio\//.test(dataUrl)) return NextResponse.json({ error: "الملف ليس مقطعًا صوتيًا" }, { status: 400 });

      await db
        .insert(mediaAssets)
        .values({
          teacherId: tid,
          lessonId,
          kind,
          slot,
          title: title || known.label,
          altText: altText || (known as { label: string }).label,
          mime: mime || (kind === "audio" ? "audio/webm" : "image/webp"),
          dataUrl,
          bytes,
          active: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [mediaAssets.lessonId, mediaAssets.slot, mediaAssets.active],
          set: { title: title || (known as { label: string }).label, altText: altText || (known as { label: string }).label, mime: mime || (kind === "audio" ? "audio/webm" : "image/webp"), dataUrl, bytes, active: true, updatedAt: new Date() },
        });
      await logAudit("teacher", tid, kind === "audio" ? "audio_media_saved" : "image_media_saved", "media_assets", null, { slot, bytes });
      return NextResponse.json({ ok: true, msg: `تم تحديث «${(known as { label: string }).label}» وسيظهر لجميع الطلاب فورًا` });
    }
    if (action === "resetMedia") {
      const slot = s(p, "slot");
      await db.delete(mediaAssets).where(and(eq(mediaAssets.lessonId, lessonId), eq(mediaAssets.slot, slot)));
      await logAudit("teacher", tid, "media_reset", "media_assets", null, { slot });
      return NextResponse.json({ ok: true, msg: "تمت استعادة الوسيلة الافتراضية" });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err) {
    console.error("teacher action error", action, err);
    return NextResponse.json({ error: "تعذر تنفيذ الطلب، حاول مرة أخرى" }, { status: 500 });
  }
}
