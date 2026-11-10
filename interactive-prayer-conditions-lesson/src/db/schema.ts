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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    skippedSlides: jsonb("skipped_slides").$type<string[]>().notNull().default([]),
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
    allowSkip: boolean("allow_skip").notNull().default(true),
    activityRules: jsonb("activity_rules").$type<Record<string, { required: boolean }>>().notNull().default({}),
    videoUrl: text("video_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teacher_settings_teacher_lesson_uq").on(t.teacherId, t.lessonId)],
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

/** وسائط منشورة مشتركة لجميع الأجهزة؛ منفصلة عن تسجيلات الطلاب الخاصة. */
export const lessonMedia = pgTable(
  "lesson_media",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    slot: varchar("slot", { length: 64 }),
    slideKey: varchar("slide_key", { length: 64 }),
    title: text("title").notNull(),
    alt: text("alt").notNull().default(""),
    source: varchar("source", { length: 16 }).notNull().default("uploaded"),
    mimeType: varchar("mime_type", { length: 64 }).notNull(),
    dataBase64: text("data_base64"),
    url: text("url"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    active: boolean("active").notNull().default(true),
    orderIndex: integer("order_index").notNull().default(0),
    legacyAudioId: integer("legacy_audio_id")
      .unique()
      .references(() => audioRecordings.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lesson_media_lesson_slot_uq").on(t.lessonId, t.slot),
    index("lesson_media_published_idx").on(t.lessonId, t.kind, t.active),
    index("lesson_media_slide_idx").on(t.lessonId, t.slideKey),
    check("lesson_media_kind_check", sql`${t.kind} in ('image','audio')`),
    check("lesson_media_source_check", sql`(${t.source} = 'uploaded' and ${t.dataBase64} is not null and ${t.url} is null) or (${t.source} = 'url' and ${t.url} is not null and ${t.dataBase64} is null)`),
    check("lesson_media_target_check", sql`(${t.kind} = 'image' and ${t.slot} is not null and ${t.slideKey} is null) or (${t.kind} = 'audio' and ${t.slideKey} is not null and ${t.slot} is null)`),
  ],
);

/** مسابقة السبورة الذكية عن بُعد: غرفة يتحكم بها المعلم وأجهزة طلاب مستقلة. */
export const liveQuizRooms = pgTable(
  "live_quiz_rooms",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 8 }).notNull().unique(),
    mode: varchar("mode", { length: 24 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("lobby"),
    currentRound: integer("current_round").notNull().default(0),
    questionSeconds: integer("question_seconds").notNull().default(30),
    timerEnabled: boolean("timer_enabled").notNull().default(true),
    autoReveal: boolean("auto_reveal").notNull().default(true),
    endReason: varchar("end_reason", { length: 24 }).$type<"timer" | "all_answered" | "manual" | null>(),
    questions: jsonb("questions").$type<LiveQuestion[]>().notNull(),
    questionEndsAt: timestamp("question_ends_at", { withTimezone: true }),
    timerPausedAt: timestamp("timer_paused_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("live_quiz_rooms_teacher_idx").on(t.teacherId, t.createdAt), check("live_quiz_rooms_status_check", sql`${t.status} in ('lobby','active','reveal','ended')`)],
);

export const liveQuizPlayers = pgTable(
  "live_quiz_players",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull().references(() => liveQuizRooms.id, { onDelete: "cascade" }),
    studentId: integer("student_id").references(() => students.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    active: boolean("active").notNull().default(true),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("live_quiz_players_room_name_uq").on(t.roomId, t.nameKey), index("live_quiz_players_room_idx").on(t.roomId)],
);

export const liveQuizAnswers = pgTable(
  "live_quiz_answers",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull().references(() => liveQuizRooms.id, { onDelete: "cascade" }),
    playerId: integer("player_id").notNull().references(() => liveQuizPlayers.id, { onDelete: "cascade" }),
    roundIndex: integer("round_index").notNull(),
    optionId: varchar("option_id", { length: 64 }).notNull(),
    isCorrect: boolean("is_correct").notNull(),
    points: integer("points").notNull().default(0),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("live_quiz_answers_once_uq").on(t.roomId, t.playerId, t.roundIndex), index("live_quiz_answers_round_idx").on(t.roomId, t.roundIndex)],
);

import type { LiveQuestion } from "@/lib/live-quiz";
export type { LiveQuestion } from "@/lib/live-quiz";
export type LiveQuizRoom = typeof liveQuizRooms.$inferSelect;
export type LiveQuizPlayer = typeof liveQuizPlayers.$inferSelect;
export type LessonMedia = typeof lessonMedia.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type StudentAnswer = typeof studentAnswers.$inferSelect;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type TeacherSettings = typeof teacherSettings.$inferSelect;
export type LessonSlide = typeof lessonSlides.$inferSelect;
