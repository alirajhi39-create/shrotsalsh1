"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
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
} from "@/db/schema";
import {
  TEACHER_COOKIE,
  TEACHER_SESSION_SECONDS,
  clearCookieOptions,
  createSignedToken,
  generateResumeCode,
  getTeacherSession,
  hashPassword,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { bestAttemptPercent, issueCertificate, logAudit, recomputeAttempt, recomputeProgress } from "@/lib/student";

async function guard() {
  const s = await getTeacherSession();
  if (!s) redirect("/teacher/login?error=session");
  return s;
}

function back(path: string, msg: string, isError = false): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${isError ? "error" : "msg"}=${encodeURIComponent(msg)}`);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) ? n : d;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true" || fd.get(k) === "1";

/* ------------------------------------------------------------------ */
/*  الدخول والخروج                                                       */
/* ------------------------------------------------------------------ */

/** دخول المعلم بكلمة المرور فقط (بدون اسم مستخدم) */
export async function loginAction(formData: FormData) {
  await ensureSeeded();
  const password = String(formData.get("password") ?? "");
  const all = password ? await db.select().from(teachers) : [];
  const t = all.find((row) => verifyPassword(password, row.passwordHash)) ?? null;
  if (!t) {
    await logAudit("teacher", null, "login_failed", "teachers", null);
    redirect("/teacher/login?error=1");
  }
  const h = await headers();
  const jar = await cookies();
  jar.set(
    TEACHER_COOKIE,
    createSignedToken({ tid: t.id, u: t.username }, TEACHER_SESSION_SECONDS),
    sessionCookieOptions(h, TEACHER_SESSION_SECONDS),
  );
  await logAudit("teacher", t.id, "login", "teachers", t.id);
  redirect("/teacher");
}

export async function logoutAction() {
  const h = await headers();
  const jar = await cookies();
  jar.set(TEACHER_COOKIE, "", clearCookieOptions(h));
  redirect("/teacher/login");
}

/* ------------------------------------------------------------------ */
/*  الفصول                                                              */
/* ------------------------------------------------------------------ */

export async function addClassroom(formData: FormData) {
  const s = await guard();
  const name = str(formData, "name");
  if (name.length < 2) back("/teacher/students", "اسم الفصل قصير", true);
  const [row] = await db.insert(classrooms).values({ teacherId: s.teacherId, name }).onConflictDoNothing().returning();
  if (!row) back("/teacher/students", "الفصل موجود مسبقًا", true);
  await logAudit("teacher", s.teacherId, "classroom_added", "classrooms", row.id, { name });
  revalidatePath("/teacher/students");
  back("/teacher/students", `تمت إضافة فصل ${name}`);
}

export async function toggleClassroom(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const [c] = await db.select().from(classrooms).where(and(eq(classrooms.id, id), eq(classrooms.teacherId, s.teacherId))).limit(1);
  if (!c) back("/teacher/students", "الفصل غير موجود", true);
  await db.update(classrooms).set({ active: !c.active }).where(eq(classrooms.id, id));
  await logAudit("teacher", s.teacherId, "classroom_toggled", "classrooms", id, { active: !c.active });
  revalidatePath("/teacher/students");
  back("/teacher/students", c.active ? "تم إيقاف الفصل" : "تم تفعيل الفصل");
}

export async function deleteClassroom(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const [c] = await db.select().from(classrooms).where(and(eq(classrooms.id, id), eq(classrooms.teacherId, s.teacherId))).limit(1);
  if (!c) back("/teacher/students", "الفصل غير موجود", true);
  const [st] = await db.select({ id: students.id }).from(students).where(eq(students.classroomId, id)).limit(1);
  if (st) back("/teacher/students", "لا يمكن حذف فصل فيه طلاب؛ انقل الطلاب أولًا", true);
  await db.delete(classrooms).where(eq(classrooms.id, id));
  await logAudit("teacher", s.teacherId, "classroom_deleted", "classrooms", id, { name: c.name });
  revalidatePath("/teacher/students");
  back("/teacher/students", "تم حذف الفصل");
}

/* ------------------------------------------------------------------ */
/*  الطلاب                                                              */
/* ------------------------------------------------------------------ */

async function ownedStudent(teacherId: number, studentId: number) {
  const [row] = await db
    .select({ id: students.id, name: students.name, classroomId: students.classroomId, classroomName: classrooms.name, locked: students.locked })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

async function ownedClassroom(teacherId: number, classroomId: number) {
  const [c] = await db.select().from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId))).limit(1);
  return c ?? null;
}

export async function addStudent(formData: FormData) {
  const s = await guard();
  const name = str(formData, "name").replace(/\s+/g, " ");
  const classroomId = num(formData, "classroomId");
  if (name.length < 2) back("/teacher/students", "اسم الطالب قصير", true);
  if (!(await ownedClassroom(s.teacherId, classroomId))) back("/teacher/students", "الفصل غير صالح", true);
  const [row] = await db
    .insert(students)
    .values({ classroomId, name, resumeCode: generateResumeCode(), locked: true })
    .onConflictDoNothing()
    .returning();
  if (!row) back("/teacher/students", "الطالب مسجل مسبقًا في هذا الفصل", true);
  const lessonId = await ensureSeeded();
  await db.insert(studentProgress).values({ studentId: row.id, lessonId }).onConflictDoNothing();
  await logAudit("teacher", s.teacherId, "student_added", "students", row.id, { name, classroomId });
  revalidatePath("/teacher/students");
  back("/teacher/students", `تمت إضافة الطالب ${name} — رمز الاستكمال: ${row.resumeCode}`);
}

export async function updateStudent(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const name = str(formData, "name").replace(/\s+/g, " ");
  const classroomId = num(formData, "classroomId", st.classroomId);
  const locked = bool(formData, "locked");
  if (name.length < 2) back(`/teacher/students/${id}`, "اسم الطالب قصير", true);
  if (!(await ownedClassroom(s.teacherId, classroomId))) back(`/teacher/students/${id}`, "الفصل غير صالح", true);
  try {
    await db.update(students).set({ name, classroomId, locked }).where(eq(students.id, id));
  } catch {
    back(`/teacher/students/${id}`, "يوجد طالب آخر بنفس الاسم في هذا الفصل", true);
  }
  await logAudit("teacher", s.teacherId, "student_updated", "students", id, { name, classroomId, locked });
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, "تم حفظ بيانات الطالب");
}

export async function deleteStudent(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  await db.delete(students).where(eq(students.id, id));
  await logAudit("teacher", s.teacherId, "student_deleted", "students", id, { name: st.name });
  revalidatePath("/teacher/students");
  back("/teacher/students", `تم حذف الطالب ${st.name} وجميع بياناته`);
}

export async function resetStudentProgress(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const lessonId = await ensureSeeded();
  await db.delete(studentAnswers).where(and(eq(studentAnswers.studentId, id), eq(studentAnswers.lessonId, lessonId)));
  await db.delete(quizAttempts).where(and(eq(quizAttempts.studentId, id), eq(quizAttempts.lessonId, lessonId)));
  await db.delete(achievements).where(and(eq(achievements.studentId, id), eq(achievements.lessonId, lessonId)));
  await db.delete(certificates).where(and(eq(certificates.studentId, id), eq(certificates.lessonId, lessonId)));
  await db.delete(audioRecordings).where(and(eq(audioRecordings.studentId, id), eq(audioRecordings.lessonId, lessonId)));
  await db
    .update(studentProgress)
    .set({ currentSlide: 0, completedSlides: [], points: 0, stars: 0, extraAttempts: 0, completedAt: null, updatedAt: new Date() })
    .where(and(eq(studentProgress.studentId, id), eq(studentProgress.lessonId, lessonId)));
  await logAudit("teacher", s.teacherId, "student_reset", "students", id);
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, "تمت إعادة تعيين تقدم الطالب");
}

export async function regenerateResumeCode(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const code = generateResumeCode();
  await db.update(students).set({ resumeCode: code }).where(eq(students.id, id));
  await db.update(studentSessions).set({ revoked: true }).where(eq(studentSessions.studentId, id));
  await logAudit("teacher", s.teacherId, "resume_code_regenerated", "students", id);
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, `رمز الاستكمال الجديد: ${code} (تم إنهاء الجلسات السابقة)`);
}

export async function grantExtraAttempt(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const lessonId = await ensureSeeded();
  const [p] = await db.select().from(studentProgress).where(and(eq(studentProgress.studentId, id), eq(studentProgress.lessonId, lessonId))).limit(1);
  if (p) await db.update(studentProgress).set({ extraAttempts: p.extraAttempts + 1 }).where(eq(studentProgress.id, p.id));
  else await db.insert(studentProgress).values({ studentId: id, lessonId, extraAttempts: 1 });
  await logAudit("teacher", s.teacherId, "extra_attempt_granted", "students", id);
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, "تم السماح بمحاولة إضافية للاختبار");
}

/* ------------------------------------------------------------------ */
/*  تصحيح الإجابات الكتابية                                              */
/* ------------------------------------------------------------------ */

export async function gradeAnswer(formData: FormData) {
  const s = await guard();
  const answerId = num(formData, "answerId");
  const [a] = await db.select().from(studentAnswers).where(eq(studentAnswers.id, answerId)).limit(1);
  if (!a) back("/teacher/students", "الإجابة غير موجودة", true);
  const st = await ownedStudent(s.teacherId, a.studentId);
  if (!st) back("/teacher/students", "غير مصرح", true);
  const score = Math.max(0, Math.min(a.maxScore, Math.round(num(formData, "score"))));
  const feedback = str(formData, "feedback").slice(0, 500);
  await db
    .update(studentAnswers)
    .set({ teacherScore: score, teacherFeedback: feedback || null, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(studentAnswers.id, answerId));
  if (a.attemptId !== 0) {
    const [attempt] = await db
      .select({ id: quizAttempts.id })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.studentId, a.studentId), eq(quizAttempts.lessonId, a.lessonId), eq(quizAttempts.attemptNumber, a.attemptId)))
      .limit(1);
    if (attempt) await recomputeAttempt(attempt.id);
  } else {
    await recomputeProgress(a.studentId, a.lessonId);
  }
  await logAudit("teacher", s.teacherId, "answer_graded", "student_answers", answerId, { score });
  revalidatePath(`/teacher/students/${a.studentId}`);
  revalidatePath("/teacher");
  back(`/teacher/students/${a.studentId}`, "تم حفظ التصحيح");
}

/* ------------------------------------------------------------------ */
/*  الشهادات                                                            */
/* ------------------------------------------------------------------ */

export async function issueCertificateAction(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const lessonId = await ensureSeeded();
  const best = (await bestAttemptPercent(id, lessonId)) ?? 0;
  await issueCertificate({ id: st.id, name: st.name, classroomName: st.classroomName }, lessonId, best, "teacher");
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, "تم إصدار الشهادة");
}

export async function revokeCertificateAction(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const st = await ownedStudent(s.teacherId, id);
  if (!st) back("/teacher/students", "الطالب غير موجود", true);
  const lessonId = await ensureSeeded();
  await db.update(certificates).set({ revoked: true }).where(and(eq(certificates.studentId, id), eq(certificates.lessonId, lessonId)));
  await logAudit("teacher", s.teacherId, "certificate_revoked", "certificates", null, { studentId: id });
  revalidatePath(`/teacher/students/${id}`);
  back(`/teacher/students/${id}`, "تم إلغاء الشهادة");
}

/* ------------------------------------------------------------------ */
/*  الإعدادات                                                           */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({
  passPercent: z.coerce.number().int().min(50).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  videoUrl: z.string().trim().max(500),
});

export async function updateSettings(formData: FormData) {
  const s = await guard();
  const lessonId = await ensureSeeded();
  const parsed = settingsSchema.safeParse({
    passPercent: formData.get("passPercent"),
    maxAttempts: formData.get("maxAttempts"),
    videoUrl: formData.get("videoUrl") ?? "",
  });
  if (!parsed.success) back("/teacher/settings", "قيم غير صالحة (نسبة النجاح 50–100، المحاولات 1–10)", true);
  const videoUrl = parsed.data.videoUrl;
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) back("/teacher/settings", "رابط الفيديو يجب أن يبدأ بـ http أو https", true);
  await db
    .insert(teacherSettings)
    .values({
      teacherId: s.teacherId,
      lessonId,
      passPercent: parsed.data.passPercent,
      maxAttempts: parsed.data.maxAttempts,
      allowAudio: bool(formData, "allowAudio"),
      soundsEnabled: bool(formData, "soundsEnabled"),
      videoUrl: videoUrl || null,
    })
    .onConflictDoUpdate({
      target: [teacherSettings.teacherId, teacherSettings.lessonId],
      set: {
        passPercent: parsed.data.passPercent,
        maxAttempts: parsed.data.maxAttempts,
        allowAudio: bool(formData, "allowAudio"),
        soundsEnabled: bool(formData, "soundsEnabled"),
        videoUrl: videoUrl || null,
        updatedAt: new Date(),
      },
    });
  await logAudit("teacher", s.teacherId, "settings_updated", "teacher_settings", null, parsed.data);
  revalidatePath("/teacher/settings");
  back("/teacher/settings", "تم حفظ الإعدادات");
}

export async function updateSlide(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const title = str(formData, "title");
  const subtitle = str(formData, "subtitle");
  const videoUrl = str(formData, "videoUrl");
  if (title.length < 2) back("/teacher/settings", "عنوان المحطة قصير", true);
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) back("/teacher/settings", "رابط الفيديو غير صالح", true);
  await db.update(lessonSlides).set({ title, subtitle, videoUrl: videoUrl || null }).where(eq(lessonSlides.id, id));
  await logAudit("teacher", s.teacherId, "slide_updated", "lesson_slides", id, { title });
  revalidatePath("/teacher/settings");
  back("/teacher/settings", "تم تحديث المحطة");
}

export async function changePassword(formData: FormData) {
  const s = await guard();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 6) back("/teacher/settings", "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف", true);
  const [t] = await db.select().from(teachers).where(eq(teachers.id, s.teacherId)).limit(1);
  if (!t || !verifyPassword(current, t.passwordHash)) back("/teacher/settings", "كلمة المرور الحالية غير صحيحة", true);
  await db.update(teachers).set({ passwordHash: hashPassword(next) }).where(eq(teachers.id, s.teacherId));
  await logAudit("teacher", s.teacherId, "password_changed", "teachers", s.teacherId);
  back("/teacher/settings", "تم تغيير كلمة المرور");
}

export async function uploadTeacherAudio(formData: FormData) {
  const s = await guard();
  const lessonId = await ensureSeeded();
  const file = formData.get("file");
  const slideKey = str(formData, "slideKey") || "general";
  const title = str(formData, "title") || "تسجيل المعلم";
  if (!(file instanceof File) || file.size === 0) back("/teacher/settings", "اختر ملفًا صوتيًا", true);
  if (file.size > 3 * 1024 * 1024) back("/teacher/settings", "حجم الملف يتجاوز 3 ميغابايت", true);
  if (!file.type.startsWith("audio/")) back("/teacher/settings", "الملف ليس ملفًا صوتيًا", true);
  const buf = Buffer.from(await file.arrayBuffer());
  const [rec] = await db
    .insert(audioRecordings)
    .values({ studentId: null, lessonId, slideKey, kind: "teacher", title, mimeType: file.type, dataBase64: buf.toString("base64"), durationMs: 0 })
    .returning({ id: audioRecordings.id });
  await logAudit("teacher", s.teacherId, "teacher_audio_uploaded", "audio_recordings", rec.id, { title, slideKey });
  revalidatePath("/teacher/settings");
  back("/teacher/settings", "تم رفع الملف الصوتي");
}

export async function deleteTeacherAudio(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  await db.delete(audioRecordings).where(and(eq(audioRecordings.id, id), eq(audioRecordings.kind, "teacher")));
  await logAudit("teacher", s.teacherId, "teacher_audio_deleted", "audio_recordings", id);
  revalidatePath("/teacher/settings");
  back("/teacher/settings", "تم حذف الملف الصوتي");
}

/* ------------------------------------------------------------------ */
/*  الأسئلة                                                             */
/* ------------------------------------------------------------------ */

const lines = (v: string) =>
  v
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

export async function saveQuestion(formData: FormData) {
  const s = await guard();
  const lessonId = await ensureSeeded();
  const id = num(formData, "id");
  const kind = str(formData, "kind");
  const slideKey = str(formData, "slideKey") === "book" ? "book" : "quiz";
  const prompt = str(formData, "prompt");
  const skill = str(formData, "skill");
  const explanation = str(formData, "explanation");
  const points = Math.max(1, Math.min(10, Math.round(num(formData, "points", 1))));
  const active = bool(formData, "active");
  if (prompt.length < 3) back("/teacher/questions", "نص السؤال قصير", true);

  let options: Record<string, unknown> = {};
  let answer: Record<string, unknown> = {};
  switch (kind) {
    case "mcq":
    case "situation":
    case "fill": {
      const choices = lines(str(formData, "choices"));
      const index = num(formData, "correctIndex", -1);
      if (choices.length < 2 || index < 0 || index >= choices.length) back("/teacher/questions", "أدخل خيارين على الأقل وحدد الإجابة الصحيحة", true);
      options = { choices };
      answer = { index };
      break;
    }
    case "truefalse":
      answer = { value: str(formData, "tfValue") === "true" };
      break;
    case "multi": {
      const choices = lines(str(formData, "choices"));
      const indices = lines(str(formData, "correctIndices").replace(/[،,]/g, "\n"))
        .map((x) => Number(x) - 1)
        .filter((n) => Number.isInteger(n) && n >= 0 && n < choices.length);
      if (choices.length < 2 || !indices.length) back("/teacher/questions", "أدخل الخيارات وأرقام الإجابات الصحيحة", true);
      options = { choices };
      answer = { indices: Array.from(new Set(indices)) };
      break;
    }
    case "order": {
      const order = lines(str(formData, "orderWords"));
      if (order.length < 2) back("/teacher/questions", "أدخل كلمتين على الأقل (كل كلمة في سطر بالترتيب الصحيح)", true);
      options = { words: order };
      answer = { order };
      break;
    }
    case "dragdrop": {
      const pairs = lines(str(formData, "pairs"))
        .map((l) => l.split("=").map((x) => x.trim()))
        .filter((p) => p.length === 2 && p[0] && p[1]);
      if (pairs.length < 2) back("/teacher/questions", "أدخل سطرين على الأقل بصيغة: العنصر=المنطقة", true);
      const map = Object.fromEntries(pairs);
      options = { items: pairs.map((p) => p[0]), zones: Array.from(new Set(pairs.map((p) => p[1]))) };
      answer = { map };
      break;
    }
    case "essay":
      options = { minLength: 5 };
      answer = { modelAnswer: str(formData, "modelAnswer"), keywords: lines(str(formData, "keywords").replace(/[،,]/g, "\n")) };
      break;
    default:
      back("/teacher/questions", "نوع سؤال غير معروف", true);
  }

  if (id) {
    await db
      .update(questions)
      .set({ kind, slideKey, prompt, options, answer, explanation, skill, points, active, updatedAt: new Date() })
      .where(and(eq(questions.id, id), eq(questions.lessonId, lessonId)));
    await logAudit("teacher", s.teacherId, "question_updated", "questions", id);
  } else {
    const key = `custom_${Date.now().toString(36)}`;
    const [row] = await db
      .insert(questions)
      .values({ lessonId, slideKey, key, kind, prompt, options, answer, explanation, skill, points, active, orderIndex: 1000 })
      .returning();
    await logAudit("teacher", s.teacherId, "question_added", "questions", row.id);
  }
  revalidatePath("/teacher/questions");
  back("/teacher/questions", "تم حفظ السؤال");
}

export async function toggleQuestion(formData: FormData) {
  const s = await guard();
  const id = num(formData, "id");
  const [q] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!q) back("/teacher/questions", "السؤال غير موجود", true);
  await db.update(questions).set({ active: !q.active, updatedAt: new Date() }).where(eq(questions.id, id));
  await logAudit("teacher", s.teacherId, "question_toggled", "questions", id, { active: !q.active });
  revalidatePath("/teacher/questions");
  back("/teacher/questions", q.active ? "تم تعطيل السؤال" : "تم تفعيل السؤال");
}
