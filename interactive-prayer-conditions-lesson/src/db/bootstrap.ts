import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * تهيئة ذاتية للمخطط (شبكة أمان): تُنشئ الجداول والفهارس إن لم تكن موجودة.
 * مطابقة لملف الهجرة drizzle/0000_init_shurut_alsalah.sql، وآمنة للتكرار.
 * تُنفَّذ كل عبارة على حدة لتعمل مع سائق Neon HTTP وسائق node-postgres.
 */

export const TABLE_NAMES = [
  "teachers",
  "lessons",
  "classrooms",
  "students",
  "lesson_slides",
  "activities",
  "questions",
  "student_sessions",
  "student_progress",
  "student_answers",
  "quiz_attempts",
  "achievements",
  "certificates",
  "audio_recordings",
  "teacher_settings",
  "audit_logs",
  "lesson_media",
  "live_quiz_rooms",
  "live_quiz_players",
  "live_quiz_answers",
] as const;

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "teachers" (
    "id" serial PRIMARY KEY NOT NULL,
    "username" varchar(64) NOT NULL,
    "password_hash" text NOT NULL,
    "name" text NOT NULL,
    "school" text DEFAULT '' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "teachers_username_unique" UNIQUE("username")
  )`,
  `CREATE TABLE IF NOT EXISTS "lessons" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" varchar(64) NOT NULL,
    "title" text NOT NULL,
    "subject" text NOT NULL,
    "grade" text NOT NULL,
    "lesson_number" integer DEFAULT 1 NOT NULL,
    "pages" text DEFAULT '' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "lessons_slug_unique" UNIQUE("slug")
  )`,
  `CREATE TABLE IF NOT EXISTS "classrooms" (
    "id" serial PRIMARY KEY NOT NULL,
    "teacher_id" integer NOT NULL,
    "name" text NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "classrooms_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "students" (
    "id" serial PRIMARY KEY NOT NULL,
    "classroom_id" integer NOT NULL,
    "name" text NOT NULL,
    "resume_code" varchar(12) NOT NULL,
    "locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "students_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE restrict ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "lesson_slides" (
    "id" serial PRIMARY KEY NOT NULL,
    "lesson_id" integer NOT NULL,
    "key" varchar(64) NOT NULL,
    "order_index" integer NOT NULL,
    "title" text NOT NULL,
    "subtitle" text DEFAULT '' NOT NULL,
    "strategy" text DEFAULT '' NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "video_url" text,
    "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "lesson_slides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "activities" (
    "id" serial PRIMARY KEY NOT NULL,
    "slide_id" integer NOT NULL,
    "key" varchar(64) NOT NULL,
    "title" text NOT NULL,
    "kind" varchar(32) NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "max_score" integer DEFAULT 1 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT "activities_slide_id_lesson_slides_id_fk" FOREIGN KEY ("slide_id") REFERENCES "public"."lesson_slides"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "questions" (
    "id" serial PRIMARY KEY NOT NULL,
    "lesson_id" integer NOT NULL,
    "slide_key" varchar(64) NOT NULL,
    "key" varchar(64) NOT NULL,
    "kind" varchar(32) NOT NULL,
    "prompt" text NOT NULL,
    "options" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "answer" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "explanation" text DEFAULT '' NOT NULL,
    "skill" text DEFAULT '' NOT NULL,
    "points" integer DEFAULT 1 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "questions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "student_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "token_hash" varchar(128) NOT NULL,
    "user_agent" text DEFAULT '' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "student_sessions_token_hash_unique" UNIQUE("token_hash"),
    CONSTRAINT "student_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "student_progress" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "current_slide" integer DEFAULT 0 NOT NULL,
    "completed_slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "stars" integer DEFAULT 0 NOT NULL,
    "extra_attempts" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "student_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "student_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "student_answers" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "slide_key" varchar(64) NOT NULL,
    "activity_key" varchar(64) NOT NULL,
    "question_id" integer,
    "attempt_id" integer DEFAULT 0 NOT NULL,
    "answer" jsonb NOT NULL,
    "is_correct" boolean,
    "score" integer DEFAULT 0 NOT NULL,
    "max_score" integer DEFAULT 1 NOT NULL,
    "needs_review" boolean DEFAULT false NOT NULL,
    "teacher_score" integer,
    "teacher_feedback" text,
    "reviewed_at" timestamp with time zone,
    "idempotency_key" varchar(80) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "student_answers_idempotency_key_unique" UNIQUE("idempotency_key"),
    CONSTRAINT "student_answers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "student_answers_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "student_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "quiz_attempts" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "attempt_number" integer NOT NULL,
    "auto_score" integer DEFAULT 0 NOT NULL,
    "max_auto_score" integer DEFAULT 0 NOT NULL,
    "teacher_score" integer DEFAULT 0 NOT NULL,
    "max_teacher_score" integer DEFAULT 0 NOT NULL,
    "percent" real DEFAULT 0 NOT NULL,
    "pending_review" boolean DEFAULT false NOT NULL,
    "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "skill_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "idempotency_key" varchar(80) NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "quiz_attempts_idempotency_key_unique" UNIQUE("idempotency_key"),
    CONSTRAINT "quiz_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "achievements" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "key" varchar(64) NOT NULL,
    "title" text NOT NULL,
    "icon" text DEFAULT '⭐' NOT NULL,
    "earned_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "achievements_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "achievements_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "certificates" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "serial" varchar(32) NOT NULL,
    "student_name" text NOT NULL,
    "classroom_name" text NOT NULL,
    "percent" real NOT NULL,
    "issued_by" varchar(16) DEFAULT 'system' NOT NULL,
    "revoked" boolean DEFAULT false NOT NULL,
    "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "certificates_serial_unique" UNIQUE("serial"),
    CONSTRAINT "certificates_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "certificates_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "audio_recordings" (
    "id" serial PRIMARY KEY NOT NULL,
    "student_id" integer,
    "lesson_id" integer NOT NULL,
    "slide_key" varchar(64) NOT NULL,
    "kind" varchar(16) DEFAULT 'student' NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "mime_type" varchar(64) NOT NULL,
    "data_base64" text NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "audio_recordings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "audio_recordings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "teacher_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "teacher_id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "pass_percent" integer DEFAULT 80 NOT NULL,
    "max_attempts" integer DEFAULT 2 NOT NULL,
    "allow_audio" boolean DEFAULT true NOT NULL,
    "sounds_enabled" boolean DEFAULT true NOT NULL,
    "video_url" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "teacher_settings_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "teacher_settings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action
  )`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "actor_type" varchar(16) NOT NULL,
    "actor_id" integer,
    "action" varchar(64) NOT NULL,
    "entity" varchar(64) DEFAULT '' NOT NULL,
    "entity_id" integer,
    "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "lesson_media" (
    "id" serial PRIMARY KEY NOT NULL,
    "lesson_id" integer NOT NULL,
    "teacher_id" integer,
    "kind" varchar(16) NOT NULL,
    "slot" varchar(64),
    "slide_key" varchar(64),
    "title" text NOT NULL,
    "alt" text DEFAULT '' NOT NULL,
    "source" varchar(16) DEFAULT 'uploaded' NOT NULL,
    "mime_type" varchar(64) NOT NULL,
    "data_base64" text,
    "url" text,
    "size_bytes" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "legacy_audio_id" integer,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "lesson_media_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "lesson_media_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action,
    CONSTRAINT "lesson_media_legacy_audio_id_audio_recordings_id_fk" FOREIGN KEY ("legacy_audio_id") REFERENCES "public"."audio_recordings"("id") ON DELETE set null ON UPDATE no action,
    CONSTRAINT "lesson_media_legacy_audio_id_unique" UNIQUE("legacy_audio_id"),
    CONSTRAINT "lesson_media_kind_check" CHECK ("kind" IN ('image','audio')),
    CONSTRAINT "lesson_media_source_check" CHECK (("source" = 'uploaded' AND "data_base64" IS NOT NULL AND "url" IS NULL) OR ("source" = 'url' AND "url" IS NOT NULL AND "data_base64" IS NULL)),
    CONSTRAINT "lesson_media_target_check" CHECK (("kind" = 'image' AND "slot" IS NOT NULL AND "slide_key" IS NULL) OR ("kind" = 'audio' AND "slide_key" IS NOT NULL AND "slot" IS NULL))
  )`,
  `CREATE TABLE IF NOT EXISTS "live_quiz_rooms" (
    "id" serial PRIMARY KEY NOT NULL,
    "lesson_id" integer NOT NULL REFERENCES "lessons"("id") ON DELETE cascade,
    "teacher_id" integer NOT NULL REFERENCES "teachers"("id") ON DELETE cascade,
    "code" varchar(8) NOT NULL UNIQUE,
    "mode" varchar(24) NOT NULL,
    "status" varchar(16) DEFAULT 'lobby' NOT NULL,
    "current_round" integer DEFAULT 0 NOT NULL,
    "question_seconds" integer DEFAULT 30 NOT NULL,
    "timer_enabled" boolean DEFAULT true NOT NULL,
    "auto_reveal" boolean DEFAULT true NOT NULL,
    "questions" jsonb NOT NULL,
    "question_ends_at" timestamp with time zone,
    "timer_paused_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "live_quiz_rooms_status_check" CHECK ("status" in ('lobby','active','reveal','ended'))
  )`,
  `CREATE TABLE IF NOT EXISTS "live_quiz_players" (
    "id" serial PRIMARY KEY NOT NULL,
    "room_id" integer NOT NULL REFERENCES "live_quiz_rooms"("id") ON DELETE cascade,
    "student_id" integer REFERENCES "students"("id") ON DELETE set null,
    "name" text NOT NULL,
    "name_key" text NOT NULL,
    "token_hash" varchar(128) NOT NULL UNIQUE,
    "active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "live_quiz_answers" (
    "id" serial PRIMARY KEY NOT NULL,
    "room_id" integer NOT NULL REFERENCES "live_quiz_rooms"("id") ON DELETE cascade,
    "player_id" integer NOT NULL REFERENCES "live_quiz_players"("id") ON DELETE cascade,
    "round_index" integer NOT NULL,
    "option_id" varchar(64) NOT NULL,
    "is_correct" boolean NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "answered_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "live_quiz_rooms_teacher_idx" ON "live_quiz_rooms" USING btree ("teacher_id","created_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "live_quiz_players_room_name_uq" ON "live_quiz_players" USING btree ("room_id","name_key")`,
  `CREATE INDEX IF NOT EXISTS "live_quiz_players_room_idx" ON "live_quiz_players" USING btree ("room_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "live_quiz_answers_once_uq" ON "live_quiz_answers" USING btree ("room_id","player_id","round_index")`,
  `CREATE INDEX IF NOT EXISTS "live_quiz_answers_round_idx" ON "live_quiz_answers" USING btree ("room_id","round_index")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "lesson_media_lesson_slot_uq" ON "lesson_media" USING btree ("lesson_id","slot")`,
  `CREATE INDEX IF NOT EXISTS "lesson_media_published_idx" ON "lesson_media" USING btree ("lesson_id","kind","active")`,
  `CREATE INDEX IF NOT EXISTS "lesson_media_slide_idx" ON "lesson_media" USING btree ("lesson_id","slide_key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "achievements_student_lesson_key_uq" ON "achievements" USING btree ("student_id","lesson_id","key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "activities_slide_key_uq" ON "activities" USING btree ("slide_id","key")`,
  `CREATE INDEX IF NOT EXISTS "audio_recordings_student_idx" ON "audio_recordings" USING btree ("student_id","lesson_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "certificates_student_lesson_uq" ON "certificates" USING btree ("student_id","lesson_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "classrooms_teacher_name_uq" ON "classrooms" USING btree ("teacher_id","name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "lesson_slides_lesson_key_uq" ON "lesson_slides" USING btree ("lesson_id","key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "questions_lesson_key_uq" ON "questions" USING btree ("lesson_id","key")`,
  `CREATE INDEX IF NOT EXISTS "questions_slide_idx" ON "questions" USING btree ("lesson_id","slide_key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "quiz_attempts_student_lesson_number_uq" ON "quiz_attempts" USING btree ("student_id","lesson_id","attempt_number")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "student_answers_natural_uq" ON "student_answers" USING btree ("student_id","lesson_id","slide_key","activity_key","attempt_id")`,
  `CREATE INDEX IF NOT EXISTS "student_answers_student_idx" ON "student_answers" USING btree ("student_id","lesson_id")`,
  `CREATE INDEX IF NOT EXISTS "student_answers_review_idx" ON "student_answers" USING btree ("needs_review")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "student_progress_student_lesson_uq" ON "student_progress" USING btree ("student_id","lesson_id")`,
  `CREATE INDEX IF NOT EXISTS "student_sessions_student_idx" ON "student_sessions" USING btree ("student_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "students_classroom_name_uq" ON "students" USING btree ("classroom_id","name")`,
  `CREATE INDEX IF NOT EXISTS "students_classroom_idx" ON "students" USING btree ("classroom_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "teacher_settings_teacher_lesson_uq" ON "teacher_settings" USING btree ("teacher_id","lesson_id")`,
];

let schemaPromise: Promise<void> | null = null;

/** يضمن وجود كل الجداول؛ يُنفَّذ مرة واحدة لكل عملية خادم. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const rows = (await db.execute(
        sql`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name = any(${sql.raw(`ARRAY[${TABLE_NAMES.map((t) => `'${t}'`).join(",")}]`)})`,
      )) as unknown as { rows?: { count: number }[] } | { count: number }[];
      const list = Array.isArray(rows) ? rows : (rows.rows ?? []);
      const count = Number(list[0]?.count ?? 0);
      if (count >= TABLE_NAMES.length) return;
      for (const stmt of DDL) {
        await db.execute(sql.raw(stmt));
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
