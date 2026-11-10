import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  varchar,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  المعلمون والفصول والطلاب                                            */
/* ------------------------------------------------------------------ */

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  school: text("school").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const classrooms = pgTable(
  "classrooms",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classrooms_teacher_name_uq").on(t.teacherId, t.name)],
);

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    classroomId: integer("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    resumeCode: varchar("resume_code", { length: 12 }).notNull(),
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("students_classroom_name_uq").on(t.classroomId, t.name),
    index("students_classroom_idx").on(t.classroomId),
  ],
);

/* ------------------------------------------------------------------ */
/*  الدروس والشرائح والأنشطة والأسئلة                                   */
/* ------------------------------------------------------------------ */

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  grade: text("grade").notNull(),
  lessonNumber: integer("lesson_number").notNull().default(1),
  pages: text("pages").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessonSlides = pgTable(
  "lesson_slides",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    strategy: text("strategy").notNull().default(""),
    isRequired: boolean("is_required").notNull().default(true),
    videoUrl: text("video_url"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex("lesson_slides_lesson_key_uq").on(t.lessonId, t.key)],
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    slideId: integer("slide_id")
      .notNull()
      .references(() => lessonSlides.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    title: text("title").notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    maxScore: integer("max_score").notNull().default(1),
    orderIndex: integer("order_index").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex("activities_slide_key_uq").on(t.slideId, t.key)],
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    slideKey: varchar("slide_key", { length: 64 }).notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    answer: jsonb("answer").$type<Record<string, unknown>>().notNull().default({}),
    explanation: text("explanation").notNull().default(""),
    skill: text("skill").notNull().default(""),
    points: integer("points").notNull().default(1),
    orderIndex: integer("order_index").notNull().default(0),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("questions_lesson_key_uq").on(t.lessonId, t.key),
    index("questions_slide_idx").on(t.lessonId, t.slideKey),
  ],
);

/* ------------------------------------------------------------------ */
/*  جلسات الطلاب وتقدمهم وإجاباتهم                                     */
/* ------------------------------------------------------------------ */

export const studentSessions = pgTable(
  "student_sessions",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [index("student_sessions_student_idx").on(t.studentId)],
);

export const studentProgress = pgTable(
  "student_progress",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    currentSlide: integer("current_slide").notNull().default(0),
    completedSlides: jsonb("completed_slides").$type<string[]>().notNull().default([]),
    points: integer("points").notNull().default(0),
    stars: integer("stars").notNull().default(0),
    extraAttempts: integer("extra_attempts").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("student_progress_student_lesson_uq").on(t.studentId, t.lessonId)],
);

export const studentAnswers = pgTable(
  "student_answers",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    slideKey: varchar("slide_key", { length: 64 }).notNull(),
    activityKey: varchar("activity_key", { length: 64 }).notNull(),
    questionId: integer("question_id").references(() => questions.id, { onDelete: "set null" }),
    /** 0 = نشاط تعليمي خارج الاختبار، وإلا رقم محاولة الاختبار */
    attemptId: integer("attempt_id").notNull().default(0),
    answer: jsonb("answer").$type<unknown>().notNull(),
    isCorrect: boolean("is_correct"),
    score: integer("score").notNull().default(0),
    maxScore: integer("max_score").notNull().default(1),
    needsReview: boolean("needs_review").notNull().default(false),
    teacherScore: integer("teacher_score"),
    teacherFeedback: text("teacher_feedback"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("student_answers_natural_uq").on(
      t.studentId,
      t.lessonId,
      t.slideKey,
      t.activityKey,
      t.attemptId,
    ),
    index("student_answers_student_idx").on(t.studentId, t.lessonId),
    index("student_answers_review_idx").on(t.needsReview),
  ],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    autoScore: integer("auto_score").notNull().default(0),
    maxAutoScore: integer("max_auto_score").notNull().default(0),
    teacherScore: integer("teacher_score").notNull().default(0),
    maxTeacherScore: integer("max_teacher_score").notNull().default(0),
    percent: real("percent").notNull().default(0),
    pendingReview: boolean("pending_review").notNull().default(false),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    skillReport: jsonb("skill_report")
      .$type<Record<string, { earned: number; max: number }>>()
      .notNull()
      .default({}),
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull().unique(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("quiz_attempts_student_lesson_number_uq").on(t.studentId, t.lessonId, t.attemptNumber),
  ],
);

export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    title: text("title").notNull(),
    icon: text("icon").notNull().default("⭐"),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("achievements_student_lesson_key_uq").on(t.studentId, t.lessonId, t.key)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    serial: varchar("serial", { length: 32 }).notNull().unique(),
    studentName: text("student_name").notNull(),
    classroomName: text("classroom_name").notNull(),
    percent: real("percent").notNull(),
    issuedBy: varchar("issued_by", { length: 16 }).notNull().default("system"),
    revoked: boolean("revoked").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("certificates_student_lesson_uq").on(t.studentId, t.lessonId)],
);

export const audioRecordings = pgTable(
  "audio_recordings",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").references(() => students.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    slideKey: varchar("slide_key", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull().default("student"),
    title: text("title").notNull().default(""),
    mimeType: varchar("mime_type", { length: 64 }).notNull(),
    dataBase64: text("data_base64").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audio_recordings_student_idx").on(t.studentId, t.lessonId)],
);

export const teacherSettings = pgTable(
  "teacher_settings",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    passPercent: integer("pass_percent").notNull().default(80),
    maxAttempts: integer("max_attempts").notNull().default(2),
    allowAudio: boolean("allow_audio").notNull().default(true),
    soundsEnabled: boolean("sounds_enabled").notNull().default(true),
    videoUrl: text("video_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teacher_settings_teacher_lesson_uq").on(t.teacherId, t.lessonId)],
);

/**
 * مكتبة الوسائط: صور ومقاطع صوتية يرفعها/يضيفها المعلم،
 * وتُعرض لجميع الطلاب على كل الأجهزة فورًا (تُحفظ في قاعدة البيانات).
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull().default("image"),
    /** موضع العرض: صورة البطل، محطة 5… أو مفتاح عام */
    slot: varchar("slot", { length: 64 }).notNull(),
    title: text("title").notNull().default(""),
    altText: text("alt_text").notNull().default(""),
    mime: varchar("mime", { length: 80 }).notNull(),
    /** الترميز الأساسي (data:) أو base64 خام */
    dataUrl: text("data_url").notNull(),
    /** مفتاح الصورة الافتراضية التي تحل محلها (للتراجع) */
    replaces: varchar("replaces", { length: 120 }),
    bytes: integer("bytes").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("media_assets_lesson_slot_active_uq").on(t.lessonId, t.slot, t.active),
    index("media_assets_slot_idx").on(t.lessonId, t.slot),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorId: integer("actor_id"),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull().default(""),
    entityId: integer("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

export type Question = typeof questions.$inferSelect;
export type StudentAnswer = typeof studentAnswers.$inferSelect;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type TeacherSettings = typeof teacherSettings.$inferSelect;
export type LessonSlide = typeof lessonSlides.$inferSelect;
