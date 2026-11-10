ALTER TABLE "live_quiz_rooms" ADD COLUMN "timer_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "live_quiz_rooms" ADD COLUMN "timer_paused_at" timestamp with time zone;