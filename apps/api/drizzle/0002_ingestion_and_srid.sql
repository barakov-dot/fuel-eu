CREATE TYPE "public"."ingestion_run_status" AS ENUM('running', 'succeeded', 'partially_succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingestion_run_status" NOT NULL,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"stations_created" integer DEFAULT 0 NOT NULL,
	"stations_updated" integer DEFAULT 0 NOT NULL,
	"mappings_created" integer DEFAULT 0 NOT NULL,
	"price_observations_created" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"external_record_id" text,
	"error_code" text,
	"message" text NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_data_source_started_idx" ON "ingestion_runs" USING btree ("data_source_id","started_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_status_idx" ON "ingestion_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingestion_errors_run_id_idx" ON "ingestion_errors" USING btree ("ingestion_run_id");--> statement-breakpoint
UPDATE "stations" SET "location" = ST_SetSRID("location", 4326) WHERE ST_SRID("location") = 0;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "location" TYPE geometry(point, 4326) USING ST_SetSRID("location", 4326);--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_price_observations_ingestion_dedup_unique" ON "fuel_price_observations" USING btree ("station_source_mapping_id","fuel_type_id","observed_at","price","currency_id");
