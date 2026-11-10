CREATE TABLE "lesson_media" (
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
	CONSTRAINT "lesson_media_legacy_audio_id_unique" UNIQUE("legacy_audio_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_legacy_audio_id_audio_recordings_id_fk" FOREIGN KEY ("legacy_audio_id") REFERENCES "public"."audio_recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_media_lesson_slot_uq" ON "lesson_media" USING btree ("lesson_id","slot");--> statement-breakpoint
CREATE INDEX "lesson_media_published_idx" ON "lesson_media" USING btree ("lesson_id","kind","active");--> statement-breakpoint
CREATE INDEX "lesson_media_slide_idx" ON "lesson_media" USING btree ("lesson_id","slide_key");