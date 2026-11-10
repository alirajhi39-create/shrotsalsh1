CREATE TABLE "live_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"player_id" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"choice" varchar(120),
	"answered" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"teacher_id" integer NOT NULL,
	"mode" varchar(16) NOT NULL,
	"deck" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"reveal" boolean DEFAULT false NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_players" ADD CONSTRAINT "live_players_room_id_live_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."live_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_players_room_player_uq" ON "live_players" USING btree ("room_id","player_id");--> statement-breakpoint
CREATE INDEX "live_players_room_idx" ON "live_players" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "live_rooms_code_uq" ON "live_rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "live_rooms_teacher_idx" ON "live_rooms" USING btree ("teacher_id");