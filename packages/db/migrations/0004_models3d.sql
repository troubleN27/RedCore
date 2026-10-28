CREATE TABLE "models_3d" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"filename" text NOT NULL,
	"storage" text NOT NULL,
	"url" text NOT NULL,
	"data" "bytea",
	"size_bytes" integer NOT NULL,
	"triangles" integer NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "models_3d" ADD CONSTRAINT "models_3d_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "models_3d_product_idx" ON "models_3d" USING btree ("product_id");