CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_fuelmap_meta" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "_fuelmap_meta_key_unique" UNIQUE("key")
);
