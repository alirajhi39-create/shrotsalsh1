ALTER TABLE "live_quiz_rooms" ADD COLUMN "end_reason" varchar(24);--> statement-breakpoint
ALTER TABLE "student_progress" ADD COLUMN "skipped_slides" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "allow_skip" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "activity_rules" jsonb DEFAULT '{}'::jsonb NOT NULL;