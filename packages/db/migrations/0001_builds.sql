CREATE TYPE "public"."build_slot" AS ENUM('case', 'motherboard', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu', 'case_fan');--> statement-breakpoint
CREATE TYPE "public"."build_source" AS ENUM('manual', 'ai', 'reverse_fps', 'prebuilt');--> statement-breakpoint
CREATE TYPE "public"."build_status" AS ENUM('incomplete', 'errors', 'warnings', 'ok');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"session_id" text,
	"build_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_id" uuid NOT NULL,
	"slot" "build_slot" NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"user_id" text,
	"name" text,
	"source" "build_source" DEFAULT 'manual' NOT NULL,
	"rgb_color" text,
	"total_uzs" bigint NOT NULL,
	"power_w" integer NOT NULL,
	"compat_status" "build_status" NOT NULL,
	"signature" text NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_type_time_idx" ON "analytics_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "build_items_build_idx" ON "build_items" USING btree ("build_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builds_public_id_idx" ON "builds" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "builds_signature_idx" ON "builds" USING btree ("signature");