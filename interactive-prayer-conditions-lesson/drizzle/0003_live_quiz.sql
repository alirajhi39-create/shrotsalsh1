CREATE TABLE "live_quiz_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"round_index" integer NOT NULL,
	"option_id" varchar(64) NOT NULL,
	"is_correct" boolean NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_quiz_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"student_id" integer,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_quiz_players_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "live_quiz_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"code" varchar(8) NOT NULL,
	"mode" varchar(24) NOT NULL,
	"status" varchar(16) DEFAULT 'lobby' NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"question_seconds" integer DEFAULT 30 NOT NULL,
	"questions" jsonb NOT NULL,
	"question_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "live_quiz_rooms_code_unique" UNIQUE("code"),
	CONSTRAINT "live_quiz_rooms_status_check" CHECK ("live_quiz_rooms"."status" in ('lobby','active','reveal','ended'))
);
--> statement-breakpoint
ALTER TABLE "live_quiz_answers" ADD CONSTRAINT "live_quiz_answers_room_id_live_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_quiz_answers" ADD CONSTRAINT "live_quiz_answers_player_id_live_quiz_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."live_quiz_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_quiz_players" ADD CONSTRAINT "live_quiz_players_room_id_live_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_quiz_players" ADD CONSTRAINT "live_quiz_players_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_quiz_rooms" ADD CONSTRAINT "live_quiz_rooms_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_quiz_rooms" ADD CONSTRAINT "live_quiz_rooms_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_quiz_answers_once_uq" ON "live_quiz_answers" USING btree ("room_id","player_id","round_index");--> statement-breakpoint
CREATE INDEX "live_quiz_answers_round_idx" ON "live_quiz_answers" USING btree ("room_id","round_index");--> statement-breakpoint
CREATE UNIQUE INDEX "live_quiz_players_room_name_uq" ON "live_quiz_players" USING btree ("room_id","name_key");--> statement-breakpoint
CREATE INDEX "live_quiz_players_room_idx" ON "live_quiz_players" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "live_quiz_rooms_teacher_idx" ON "live_quiz_rooms" USING btree ("teacher_id","created_at");