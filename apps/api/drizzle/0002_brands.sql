CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_text" text GENERATED ALWAYS AS (replace("brands"."name", chr(8204), ' ')) STORED,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "brands_slug_key" UNIQUE("slug"),
	CONSTRAINT "brands_slug_check" CHECK ("brands"."slug" ~ '^[a-z0-9-]+$' and char_length("brands"."slug") <= 64),
	CONSTRAINT "brands_name_check" CHECK (char_length("brands"."name") between 1 and 200),
	CONSTRAINT "brands_description_check" CHECK ("brands"."description" is null or char_length("brands"."description") between 1 and 2000)
);
--> statement-breakpoint
CREATE INDEX "brands_search_text_idx" ON "brands" USING gin ("search_text" gin_trgm_ops);