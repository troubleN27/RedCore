CREATE TYPE "public"."game_profile" AS ENUM('aaa', 'competitive');--> statement-breakpoint
CREATE TYPE "public"."fps_preset" AS ENUM('low', 'medium', 'high', 'ultra');--> statement-breakpoint
CREATE TYPE "public"."fps_resolution" AS ENUM('1080p', '1440p', '2160p');--> statement-breakpoint
CREATE TABLE "game_benchmarks" (
	"game_id" uuid NOT NULL,
	"resolution" "fps_resolution" NOT NULL,
	"preset" "fps_preset" NOT NULL,
	"ref_fps_gpu" real NOT NULL,
	"vram_req_gb" real NOT NULL,
	CONSTRAINT "game_benchmarks_game_id_resolution_preset_pk" PRIMARY KEY("game_id","resolution","preset")
);
--> statement-breakpoint
CREATE TABLE "game_cpu_caps" (
	"game_id" uuid NOT NULL,
	"preset" "fps_preset" NOT NULL,
	"ref_fps_cpu" real NOT NULL,
	CONSTRAINT "game_cpu_caps_game_id_preset_pk" PRIMARY KEY("game_id","preset")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"steam_app_id" integer,
	"cover_url" text,
	"hue" integer DEFAULT 0 NOT NULL,
	"profile" "game_profile" DEFAULT 'aaa' NOT NULL,
	"cpu_alpha" real DEFAULT 0.8 NOT NULL,
	"vendor_bias" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ram_min_gb" integer DEFAULT 16 NOT NULL,
	"ram_rec_gb" integer DEFAULT 16 NOT NULL,
	"supports" jsonb DEFAULT '{"dlss":false,"fsr":false,"xess":false,"frameGen":false}'::jsonb NOT NULL,
	"thresholds" jsonb DEFAULT '{"good":60,"playable":30}'::jsonb NOT NULL,
	"low_ratio" real DEFAULT 0.78 NOT NULL,
	"fps_cap" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "perf_gpu" ADD COLUMN "vram_gb" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_benchmarks" ADD CONSTRAINT "game_benchmarks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_cpu_caps" ADD CONSTRAINT "game_cpu_caps_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_sort_idx" ON "games" USING btree ("sort");