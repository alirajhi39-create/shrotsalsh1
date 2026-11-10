CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"kind" varchar(16) DEFAULT 'image' NOT NULL,
	"slot" varchar(64) NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"mime" varchar(80) NOT NULL,
	"data_url" text NOT NULL,
	"replaces" varchar(120),
	"bytes" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_lesson_slot_active_uq" ON "media_assets" USING btree ("lesson_id","slot","active");--> statement-breakpoint
CREATE INDEX "media_assets_slot_idx" ON "media_assets" USING btree ("lesson_id","slot");