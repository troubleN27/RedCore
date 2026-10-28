CREATE TYPE "public"."category_kind" AS ENUM('component', 'peripheral', 'prebuilt');--> statement-breakpoint
CREATE TYPE "public"."component_type" AS ENUM('cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'case_fan', 'monitor', 'keyboard', 'mouse', 'headset', 'mousepad', 'webcam', 'prebuilt');--> statement-breakpoint
CREATE TYPE "public"."filter_type" AS ENUM('enum', 'range', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('ru', 'uz');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."frame_gen" AS ENUM('none', 'fg', 'mfg');--> statement-breakpoint
CREATE TYPE "public"."gpu_vendor" AS ENUM('nvidia', 'amd', 'intel');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"component_type" "component_type" NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"spec_key" text NOT NULL,
	"type" "filter_type" NOT NULL,
	"unit" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_compatibility_key" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"category_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "prebuilt_components" (
	"prebuilt_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "prebuilt_components_prebuilt_id_component_id_pk" PRIMARY KEY("prebuilt_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"alt" jsonb,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_translations" (
	"product_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"short_description" text NOT NULL,
	"description" text,
	"seo_title" text,
	"seo_description" text,
	"source" text DEFAULT 'template' NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "product_translations_product_id_locale_pk" PRIMARY KEY("product_id","locale")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"component_type" "component_type" NOT NULL,
	"name" text NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"price_uzs" bigint NOT NULL,
	"compare_at_price_uzs" bigint,
	"cost_uzs" bigint,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"reserved_qty" integer DEFAULT 0 NOT NULL,
	"warranty_months" integer DEFAULT 12 NOT NULL,
	"specs" jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"perf_key" text,
	"model3d" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"popularity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"price_uzs" bigint NOT NULL,
	"free_from_uzs" bigint,
	"eta_min_days" integer NOT NULL,
	"eta_max_days" integer NOT NULL,
	"cod_allowed" boolean DEFAULT true NOT NULL,
	"is_pickup" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "promo_type" NOT NULL,
	"value" bigint NOT NULL,
	"min_order_uzs" bigint,
	"max_discount_uzs" bigint,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"per_user_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"applies_to" jsonb,
	"description" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"price_uzs" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perf_cpu" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gaming_index" real NOT NULL,
	"multi_thread_index" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perf_gpu" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor" "gpu_vendor" NOT NULL,
	"index1080" real NOT NULL,
	"index1440" real NOT NULL,
	"index2160" real NOT NULL,
	"rt_index" real,
	"frame_gen" "frame_gen" DEFAULT 'none' NOT NULL,
	"upscalers" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_filters" ADD CONSTRAINT "category_filters_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prebuilt_components" ADD CONSTRAINT "prebuilt_components_prebuilt_id_products_id_fk" FOREIGN KEY ("prebuilt_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prebuilt_components" ADD CONSTRAINT "prebuilt_components_component_id_products_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "category_filters_key_idx" ON "category_filters" USING btree ("category_id","spec_key");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("component_type");--> statement-breakpoint
CREATE INDEX "products_specs_idx" ON "products" USING gin ("specs" jsonb_path_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_zones_code_idx" ON "delivery_zones" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_idx" ON "promo_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "services_key_idx" ON "services" USING btree ("key");