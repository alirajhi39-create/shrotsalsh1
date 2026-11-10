ALTER TABLE "live_rooms" ADD COLUMN "started" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "live_rooms" ADD COLUMN "seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "live_rooms" ADD COLUMN "question_started_at" timestamp with time zone;