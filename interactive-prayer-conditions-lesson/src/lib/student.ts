import { cookies, headers } from "next/headers";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  students,
  classrooms,
  studentSessions,
  studentProgress,
  studentAnswers,
  quizAttempts,
  achievements,
  certificates,
  audioRecordings,
  questions,
  lessonSlides,
  teacherSettings,
  auditLogs,
  type Question,
  type TeacherSettings,
} from "@/db/schema";
import { STUDENT_COOKIE, generateSerial, hashToken, readBearerToken } from "./auth";
import { ensureSeeded } from "./seed";
import { ACTIVITIES, ACHIEVEMENT_DEFS, REQUIRED_ACTIVITY_KEYS, SLIDES } from "./content";
import { gradeQuestion, summarizeSkills } from "./grading";

/* ------------------------------------------------------------------ */
/*  الأنواع المشتركة مع الواجهة                                          */
/* ------------------------------------------------------------------ */

export type AnswerView = {
  activityKey: string;
  slideKey: string;
  answer: unknown;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  needsReview: boolean;
  teacherScore: number | null;
  teacherFeedback: string | null;
  detail?: Record<string, boolean>;
  explanation?: string;
  updatedAt: string;
};

export type QuestionView = {
  id: number;
  key: string;
  slideKey: string;
  kind: string;
  prompt: string;
  options: Record<string, unknown>;
  skill: string;
  points: number;
};

export type AttemptDetail = {
  questionId: number;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  explanation: string;
  needsReview: boolean;
};

export type AttemptView = {
  id: number;
  attemptNumber: number;
  percent: number;
  autoScore: number;
  maxAutoScore: number;
  teacherScore: number;
  maxTeacherScore: number;
  pendingReview: boolean;
  skillReport: Record<string, { earned: number; max: number }>;
  details: AttemptDetail[];
  answers: Record<string, unknown>;
  submittedAt: string;
};

export type Eligibility = { eligible: boolean; reasons: string[]; bestPercent: number | null };

export type StudentState = {
  student: { id: number; name: string; classroom: string; classroomId: number; resumeCode: string; locked: boolean };
  lesson: { id: number; title: string };
  slides: { key: string; title: string; subtitle: string; strategy: string; videoUrl: string | null; orderIndex: number }[];
  settings: { passPercent: number; maxAttempts: number; allowAudio: boolean; soundsEnabled: boolean; videoUrl: string | null };
  progress: {
    currentSlide: number;
    completedSlides: string[];
    points: number;
    stars: number;
    extraAttempts: number;
    completedAt: string | null;
  };
  answers: Record<string, AnswerView>;
  questions: QuestionView[];
  attempts: AttemptView[];
  attemptsAllowed: number;
  achievements: { key: string; title: string; icon: string; earnedAt: string }[];
  certificate: { serial: string; percent: number; issuedAt: string } | null;
  audioSlides: string[];
  eligibility: Eligibility;
};

export type CurrentStudent = {
  id: number;
  name: string;
  classroomId: number;
  classroomName: string;
  teacherId: number;
  resumeCode: string;
  locked: boolean;
  sessionId: number;
};

/* ------------------------------------------------------------------ */
/*  الجلسة                                                              */
/* ------------------------------------------------------------------ */

/**
 * يحدد الطالب الحالي من كوكي الجلسة، أو من رمز الجلسة المرسل في ترويسة Authorization
 * (احتياطي عندما يحجب المتصفح الكوكيز، مثل العرض داخل iframe في بعض المتصفحات).
 */
export async function getStudentFromCookie(): Promise<CurrentStudent | null> {
  const jar = await cookies();
  const cookieToken = jar.get(STUDENT_COOKIE)?.value ?? null;

  // لا تدع كوكي قديمًا أو جلسة ملغاة يحجبان الرمز الجديد المحفوظ في المتصفح.
  if (cookieToken) {
    const fromCookie = await getStudentByToken(cookieToken);
    if (fromCookie) return fromCookie;
  }

  try {
    const bearerToken = readBearerToken(await headers());
    if (bearerToken && bearerToken !== cookieToken) {
      return await getStudentByToken(bearerToken);
    }
  } catch {
    /* لا توجد ترويسة في هذا السياق */
  }
  return null;
}

export async function getStudentByToken(token: string): Promise<CurrentStudent | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      sessionId: studentSessions.id,
      id: students.id,
      name: students.name,
      classroomId: students.classroomId,
      classroomName: classrooms.name,
      teacherId: classrooms.teacherId,
      resumeCode: students.resumeCode,
      locked: students.locked,
    })
    .from(studentSessions)
    .innerJoin(students, eq(students.id, studentSessions.studentId))
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(
      and(
        eq(studentSessions.tokenHash, tokenHash),
        eq(studentSessions.revoked, false),
        gt(studentSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.update(studentSessions).set({ lastSeenAt: new Date() }).where(eq(studentSessions.id, row.sessionId));
  return row;
}

export async function getSettings(teacherId: number, lessonId: number): Promise<TeacherSettings> {
  const [s] = await db
    .select()
    .from(teacherSettings)
    .where(and(eq(teacherSettings.teacherId, teacherId), eq(teacherSettings.lessonId, lessonId)))
    .limit(1);
  if (s) return s;
  const [created] = await db
    .insert(teacherSettings)
    .values({ teacherId, lessonId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(teacherSettings)
    .where(and(eq(teacherSettings.teacherId, teacherId), eq(teacherSettings.lessonId, lessonId)))
    .limit(1);
  return again;
}

export async function logAudit(
  actorType: "student" | "teacher" | "system",
  actorId: number | null,
  action: string,
  entity = "",
  entityId: number | null = null,
  meta: Record<string, unknown> = {},
) {
  try {
    await db.insert(auditLogs).values({ actorType, actorId, action, entity, entityId, meta });
  } catch {
    /* لا نوقف العملية بسبب فشل التسجيل */
  }
}

/* ------------------------------------------------------------------ */
/*  التقدم                                                              */
/* ------------------------------------------------------------------ */

export async function ensureProgress(studentId: number, lessonId: number) {
  const [p] = await db
    .select()
    .from(studentProgress)
    .where(and(eq(studentProgress.studentId, studentId), eq(studentProgress.lessonId, lessonId)))
    .limit(1);
  if (p) return p;
  const [created] = await db
    .insert(studentProgress)
    .values({ studentId, lessonId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(studentProgress)
    .where(and(eq(studentProgress.studentId, studentId), eq(studentProgress.lessonId, lessonId)))
    .limit(1);
  return again;
}

/** إعادة حساب النقاط والنجوم من الإجابات المحفوظة */
export async function recomputeProgress(studentId: number, lessonId: number) {
  const rows = await db
    .select({
      activityKey: studentAnswers.activityKey,
      score: studentAnswers.score,
      teacherScore: studentAnswers.teacherScore,
      isCorrect: studentAnswers.isCorrect,
      attemptId: studentAnswers.attemptId,
    })
    .from(studentAnswers)
    .where(and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, lessonId)));

  let points = 0;
  let stars = 0;
  for (const r of rows) {
    if (r.attemptId !== 0) continue;
    points += (r.teacherScore ?? r.score) * 10;
    if (r.activityKey.startsWith("detective_case_") && r.isCorrect) stars += 1;
  }
  const best = await bestAttemptPercent(studentId, lessonId);
  if (best !== null) points += Math.round(best);
  await db
    .update(studentProgress)
    .set({ points, stars, updatedAt: new Date() })
    .where(and(eq(studentProgress.studentId, studentId), eq(studentProgress.lessonId, lessonId)));
  return { points, stars };
}

export async function bestAttemptPercent(studentId: number, lessonId: number): Promise<number | null> {
  const rows = await db
    .select({ percent: quizAttempts.percent })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)));
  if (!rows.length) return null;
  return Math.max(...rows.map((r) => r.percent));
}

export async function awardAchievement(studentId: number, lessonId: number, key: string) {
  const def = ACHIEVEMENT_DEFS[key];
  if (!def) return null;
  const [row] = await db
    .insert(achievements)
    .values({ studentId, lessonId, key, title: def.title, icon: def.icon })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/*  حفظ إجابات الأنشطة                                                  */
/* ------------------------------------------------------------------ */

export async function upsertAnswer(params: {
  studentId: number;
  lessonId: number;
  slideKey: string;
  activityKey: string;
  questionId?: number | null;
  attemptId?: number;
  answer: unknown;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  needsReview: boolean;
  idempotencyKey: string;
}) {
  const attemptId = params.attemptId ?? 0;
  // منع التكرار: نفس مفتاح الطلب → نعيد السجل الموجود
  const [dup] = await db
    .select()
    .from(studentAnswers)
    .where(eq(studentAnswers.idempotencyKey, params.idempotencyKey))
    .limit(1);
  if (dup) return { row: dup, duplicate: true };

  const [row] = await db
    .insert(studentAnswers)
    .values({
      studentId: params.studentId,
      lessonId: params.lessonId,
      slideKey: params.slideKey,
      activityKey: params.activityKey,
      questionId: params.questionId ?? null,
      attemptId,
      answer: params.answer,
      isCorrect: params.isCorrect,
      score: params.score,
      maxScore: params.maxScore,
      needsReview: params.needsReview,
      idempotencyKey: params.idempotencyKey,
    })
    .onConflictDoUpdate({
      target: [
        studentAnswers.studentId,
        studentAnswers.lessonId,
        studentAnswers.slideKey,
        studentAnswers.activityKey,
        studentAnswers.attemptId,
      ],
      set: {
        answer: params.answer,
        isCorrect: params.isCorrect,
        score: params.score,
        maxScore: params.maxScore,
        needsReview: params.needsReview,
        teacherScore: null,
        teacherFeedback: null,
        reviewedAt: null,
        idempotencyKey: params.idempotencyKey,
        updatedAt: new Date(),
      },
    })
    .returning();
  return { row, duplicate: false };
}

export async function saveActivityAnswer(
  student: CurrentStudent,
  lessonId: number,
  activityKey: string,
  answer: unknown,
  idempotencyKey: string,
) {
  const def = ACTIVITIES[activityKey];
  if (!def) throw new Error("نشاط غير معروف");
  const result = def.grade(answer);
  const { row } = await upsertAnswer({
    studentId: student.id,
    lessonId,
    slideKey: def.slideKey,
    activityKey,
    answer,
    isCorrect: result.isCorrect,
    score: result.score,
    maxScore: result.maxScore,
    needsReview: result.needsReview,
    idempotencyKey,
  });

  const newAchievements: { key: string; title: string; icon: string }[] = [];
  const push = async (key: string) => {
    const a = await awardAchievement(student.id, lessonId, key);
    if (a) newAchievements.push({ key: a.key, title: a.title, icon: a.icon });
  };
  await push("starter");
  if (activityKey === "discover_match") await push("discoverer");
  if (activityKey === "ayah_order" && result.isCorrect) await push("reciter");
  if (activityKey.startsWith("detective_case_")) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentAnswers)
      .where(
        and(
          eq(studentAnswers.studentId, student.id),
          eq(studentAnswers.lessonId, lessonId),
          eq(studentAnswers.isCorrect, true),
          sql`${studentAnswers.activityKey} like 'detective_case_%'`,
        ),
      );
    if (Number(count) >= 3) await push("detective");
  }
  if (activityKey === "champion_game" && result.isCorrect) await push("champion");

  const totals = await recomputeProgress(student.id, lessonId);
  return { row, result, newAchievements, totals };
}

export async function saveQuestionAnswer(
  student: CurrentStudent,
  lessonId: number,
  questionId: number,
  response: unknown,
  idempotencyKey: string,
) {
  const [q] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.lessonId, lessonId), eq(questions.active, true)))
    .limit(1);
  if (!q) throw new Error("سؤال غير موجود");
  if (q.slideKey === "quiz") throw new Error("أسئلة التقويم تُرسل عبر الاختبار");
  const result = gradeQuestion(q, response);
  const { row } = await upsertAnswer({
    studentId: student.id,
    lessonId,
    slideKey: q.slideKey,
    activityKey: `q_${q.id}`,
    questionId: q.id,
    answer: response,
    isCorrect: result.isCorrect,
    score: result.score,
    maxScore: result.maxScore,
    needsReview: result.needsReview,
    idempotencyKey,
  });
  await awardAchievement(student.id, lessonId, "starter");
  const totals = await recomputeProgress(student.id, lessonId);
  return { row, result, explanation: q.explanation, totals };
}

/* ------------------------------------------------------------------ */
/*  الاختبار                                                            */
/* ------------------------------------------------------------------ */

export async function getActiveQuestions(lessonId: number, slideKey?: string): Promise<Question[]> {
  const where = slideKey
    ? and(eq(questions.lessonId, lessonId), eq(questions.active, true), eq(questions.slideKey, slideKey))
    : and(eq(questions.lessonId, lessonId), eq(questions.active, true));
  return db.select().from(questions).where(where).orderBy(asc(questions.orderIndex), asc(questions.id));
}

export async function submitQuiz(
  student: CurrentStudent,
  lessonId: number,
  settings: TeacherSettings,
  answers: Record<string, unknown>,
  idempotencyKey: string,
) {
  const [dup] = await db.select().from(quizAttempts).where(eq(quizAttempts.idempotencyKey, idempotencyKey)).limit(1);
  if (dup) return { attempt: dup, duplicate: true };

  const progress = await ensureProgress(student.id, lessonId);
  const previous = await db
    .select({ n: quizAttempts.attemptNumber })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, student.id), eq(quizAttempts.lessonId, lessonId)))
    .orderBy(desc(quizAttempts.attemptNumber));
  const allowed = settings.maxAttempts + progress.extraAttempts;
  if (previous.length >= allowed) {
    throw new Error("استنفدت عدد المحاولات المسموح بها، اطلب من معلمك السماح بمحاولة جديدة");
  }
  const attemptNumber = (previous[0]?.n ?? 0) + 1;
  const qs = await getActiveQuestions(lessonId, "quiz");

  let autoScore = 0;
  let maxAutoScore = 0;
  let maxTeacherScore = 0;
  let pendingReview = false;
  const skillItems: { skill: string; earned: number; max: number }[] = [];
  const graded: { q: Question; response: unknown; r: ReturnType<typeof gradeQuestion> }[] = [];

  for (const q of qs) {
    const response = answers[String(q.id)];
    const r = gradeQuestion(q, response);
    graded.push({ q, response: response ?? null, r });
    if (r.needsReview) {
      pendingReview = true;
      maxTeacherScore += r.maxScore;
    } else {
      autoScore += r.score;
      maxAutoScore += r.maxScore;
      skillItems.push({ skill: q.skill, earned: r.score, max: r.maxScore });
    }
  }
  const percent = maxAutoScore ? (autoScore / maxAutoScore) * 100 : 0;

  const [attempt] = await db
    .insert(quizAttempts)
    .values({
      studentId: student.id,
      lessonId,
      attemptNumber,
      autoScore,
      maxAutoScore,
      teacherScore: 0,
      maxTeacherScore,
      percent,
      pendingReview,
      answers,
      skillReport: summarizeSkills(skillItems),
      idempotencyKey,
    })
    .returning();

  for (const g of graded) {
    await upsertAnswer({
      studentId: student.id,
      lessonId,
      slideKey: "quiz",
      activityKey: `q_${g.q.id}`,
      questionId: g.q.id,
      attemptId: attemptNumber,
      answer: g.response,
      isCorrect: g.r.isCorrect,
      score: g.r.score,
      maxScore: g.r.maxScore,
      needsReview: g.r.needsReview,
      idempotencyKey: `${idempotencyKey}:${g.q.id}`,
    });
  }

  if (percent >= settings.passPercent) await awardAchievement(student.id, lessonId, "quiz_passed");
  await recomputeProgress(student.id, lessonId);
  await logAudit("student", student.id, "quiz_submitted", "quiz_attempts", attempt.id, { percent, attemptNumber });
  return { attempt, duplicate: false };
}

/** إعادة حساب المحاولة بعد تصحيح المعلم للأسئلة الكتابية */
export async function recomputeAttempt(attemptId: number) {
  const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  const rows = await db
    .select()
    .from(studentAnswers)
    .where(
      and(
        eq(studentAnswers.studentId, attempt.studentId),
        eq(studentAnswers.lessonId, attempt.lessonId),
        eq(studentAnswers.slideKey, "quiz"),
        eq(studentAnswers.attemptId, attempt.attemptNumber),
      ),
    );
  let teacherScore = 0;
  let maxTeacherGraded = 0;
  let pending = false;
  for (const r of rows) {
    if (!r.needsReview) continue;
    if (r.teacherScore === null) pending = true;
    else {
      teacherScore += r.teacherScore;
      maxTeacherGraded += r.maxScore;
    }
  }
  const denominator = attempt.maxAutoScore + maxTeacherGraded;
  const percent = denominator ? ((attempt.autoScore + teacherScore) / denominator) * 100 : 0;
  const [updated] = await db
    .update(quizAttempts)
    .set({ teacherScore, percent, pendingReview: pending })
    .where(eq(quizAttempts.id, attemptId))
    .returning();
  await recomputeProgress(attempt.studentId, attempt.lessonId);
  return updated;
}

/* ------------------------------------------------------------------ */
/*  الشهادة                                                             */
/* ------------------------------------------------------------------ */

export async function checkEligibility(studentId: number, lessonId: number, settings: TeacherSettings): Promise<Eligibility> {
  const reasons: string[] = [];
  const answered = await db
    .select({ activityKey: studentAnswers.activityKey, slideKey: studentAnswers.slideKey })
    .from(studentAnswers)
    .where(
      and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, lessonId), eq(studentAnswers.attemptId, 0)),
    );
  const keys = new Set(answered.map((a) => a.activityKey));
  const missingActivities = REQUIRED_ACTIVITY_KEYS.filter((k) => !keys.has(k));
  if (missingActivities.length) {
    const slideKeys = new Set(missingActivities.map((k) => ACTIVITIES[k].slideKey));
    const names = SLIDES.filter((s) => slideKeys.has(s.key)).map((s) => s.title);
    reasons.push(`أكمل أنشطة المحطات: ${names.join("، ")}`);
  }
  const bookQs = await getActiveQuestions(lessonId, "book");
  const missingBook = bookQs.filter((q) => !keys.has(`q_${q.id}`));
  if (missingBook.length) reasons.push(`أكمل نشاط الكتاب المدرسي (${missingBook.length} أسئلة متبقية)`);

  const best = await bestAttemptPercent(studentId, lessonId);
  if (best === null) reasons.push("أدِّ التقويم الختامي");
  else if (best < settings.passPercent)
    reasons.push(`نسبتك في التقويم ${Math.round(best)}% والمطلوب ${settings.passPercent}% على الأقل`);

  return { eligible: reasons.length === 0, reasons, bestPercent: best };
}

export async function issueCertificate(
  student: { id: number; name: string; classroomName: string },
  lessonId: number,
  percent: number,
  issuedBy: "system" | "teacher",
) {
  const [existing] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.studentId, student.id), eq(certificates.lessonId, lessonId)))
    .limit(1);
  if (existing) {
    if (existing.revoked) {
      const [restored] = await db
        .update(certificates)
        .set({ revoked: false, percent, issuedAt: new Date(), issuedBy })
        .where(eq(certificates.id, existing.id))
        .returning();
      return restored;
    }
    return existing;
  }
  const [cert] = await db
    .insert(certificates)
    .values({
      studentId: student.id,
      lessonId,
      serial: generateSerial(),
      studentName: student.name,
      classroomName: student.classroomName,
      percent,
      issuedBy,
    })
    .onConflictDoNothing()
    .returning();
  await db
    .update(studentProgress)
    .set({ completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(studentProgress.studentId, student.id), eq(studentProgress.lessonId, lessonId)));
  await logAudit(issuedBy === "teacher" ? "teacher" : "student", student.id, "certificate_issued", "certificates", cert?.id ?? null);
  return cert;
}

/* ------------------------------------------------------------------ */
/*  بناء حالة الطالب الكاملة                                             */
/* ------------------------------------------------------------------ */

export function toAnswerView(r: typeof studentAnswers.$inferSelect): AnswerView {
  const def = ACTIVITIES[r.activityKey];
  const detail = def ? def.grade(r.answer).detail : undefined;
  return {
    activityKey: r.activityKey,
    slideKey: r.slideKey,
    answer: r.answer,
    isCorrect: r.isCorrect,
    score: r.score,
    maxScore: r.maxScore,
    needsReview: r.needsReview,
    teacherScore: r.teacherScore,
    teacherFeedback: r.teacherFeedback,
    detail,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function buildAttemptViews(studentId: number, lessonId: number): Promise<AttemptView[]> {
  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))
    .orderBy(asc(quizAttempts.attemptNumber));
  if (!attempts.length) return [];
  const rows = await db
    .select({
      attemptId: studentAnswers.attemptId,
      questionId: studentAnswers.questionId,
      isCorrect: studentAnswers.isCorrect,
      score: studentAnswers.score,
      maxScore: studentAnswers.maxScore,
      needsReview: studentAnswers.needsReview,
      teacherScore: studentAnswers.teacherScore,
      explanation: questions.explanation,
    })
    .from(studentAnswers)
    .leftJoin(questions, eq(questions.id, studentAnswers.questionId))
    .where(
      and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, lessonId), eq(studentAnswers.slideKey, "quiz")),
    );
  return attempts.map((a) => ({
    id: a.id,
    attemptNumber: a.attemptNumber,
    percent: a.percent,
    autoScore: a.autoScore,
    maxAutoScore: a.maxAutoScore,
    teacherScore: a.teacherScore,
    maxTeacherScore: a.maxTeacherScore,
    pendingReview: a.pendingReview,
    skillReport: a.skillReport,
    answers: a.answers,
    submittedAt: a.submittedAt.toISOString(),
    details: rows
      .filter((r) => r.attemptId === a.attemptNumber && r.questionId !== null)
      .map((r) => ({
        questionId: r.questionId as number,
        isCorrect: r.needsReview ? (r.teacherScore === null ? null : r.teacherScore >= r.maxScore) : r.isCorrect,
        score: r.teacherScore ?? r.score,
        maxScore: r.maxScore,
        explanation: r.explanation ?? "",
        needsReview: r.needsReview && r.teacherScore === null,
      })),
  }));
}

export async function buildStudentState(student: CurrentStudent): Promise<StudentState> {
  const lessonId = await ensureSeeded();
  const settings = await getSettings(student.teacherId, lessonId);
  const progress = await ensureProgress(student.id, lessonId);

  const [slideRows, answerRows, qRows, achievementRows, certRows, audioRows, attempts, eligibility] =
    await Promise.all([
      db.select().from(lessonSlides).where(eq(lessonSlides.lessonId, lessonId)).orderBy(asc(lessonSlides.orderIndex)),
      db
        .select()
        .from(studentAnswers)
        .where(
          and(eq(studentAnswers.studentId, student.id), eq(studentAnswers.lessonId, lessonId), eq(studentAnswers.attemptId, 0)),
        ),
      getActiveQuestions(lessonId),
      db.select().from(achievements).where(and(eq(achievements.studentId, student.id), eq(achievements.lessonId, lessonId))),
      db
        .select()
        .from(certificates)
        .where(and(eq(certificates.studentId, student.id), eq(certificates.lessonId, lessonId), eq(certificates.revoked, false))),
      db
        .select({ slideKey: audioRecordings.slideKey })
        .from(audioRecordings)
        .where(and(eq(audioRecordings.studentId, student.id), eq(audioRecordings.lessonId, lessonId))),
      buildAttemptViews(student.id, lessonId),
      checkEligibility(student.id, lessonId, settings),
    ]);

  const explanationById = new Map(qRows.map((q) => [q.id, q.explanation]));
  const answers: Record<string, AnswerView> = {};
  for (const r of answerRows) {
    const view = toAnswerView(r);
    if (r.questionId !== null) view.explanation = explanationById.get(r.questionId) ?? "";
    answers[r.activityKey] = view;
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      classroom: student.classroomName,
      classroomId: student.classroomId,
      resumeCode: student.resumeCode,
      locked: student.locked,
    },
    lesson: { id: lessonId, title: "شروط الصلاة (1)" },
    slides: slideRows.map((s) => ({
      key: s.key,
      title: s.title,
      subtitle: s.subtitle,
      strategy: s.strategy,
      videoUrl: s.videoUrl,
      orderIndex: s.orderIndex,
    })),
    settings: {
      passPercent: settings.passPercent,
      maxAttempts: settings.maxAttempts,
      allowAudio: settings.allowAudio,
      soundsEnabled: settings.soundsEnabled,
      videoUrl: settings.videoUrl,
    },
    progress: {
      currentSlide: progress.currentSlide,
      completedSlides: progress.completedSlides,
      points: progress.points,
      stars: progress.stars,
      extraAttempts: progress.extraAttempts,
      completedAt: progress.completedAt ? progress.completedAt.toISOString() : null,
    },
    answers,
    questions: qRows.map((q) => ({
      id: q.id,
      key: q.key,
      slideKey: q.slideKey,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      skill: q.skill,
      points: q.points,
    })),
    attempts,
    attemptsAllowed: settings.maxAttempts + progress.extraAttempts,
    achievements: achievementRows.map((a) => ({ key: a.key, title: a.title, icon: a.icon, earnedAt: a.earnedAt.toISOString() })),
    certificate: certRows[0]
      ? { serial: certRows[0].serial, percent: certRows[0].percent, issuedAt: certRows[0].issuedAt.toISOString() }
      : null,
    audioSlides: Array.from(new Set(audioRows.map((a) => a.slideKey))),
    eligibility,
  };
}
