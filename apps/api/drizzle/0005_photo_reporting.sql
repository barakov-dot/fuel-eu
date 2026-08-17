CREATE TYPE "public"."report_image_status" AS ENUM(
  'uploaded',
  'processing',
  'processed',
  'failed',
  'attached',
  'deleted'
);

CREATE TABLE "report_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "station_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "sha256" text NOT NULL,
  "status" "report_image_status" DEFAULT 'uploaded' NOT NULL,
  "expires_at" timestamp with time zone,
  "deleted_at" timestamp with time zone
);

CREATE TABLE "report_image_ocr_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_image_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "raw_text" text,
  "structured_result" jsonb,
  "processing_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_price_report_images" (
  "report_id" uuid NOT NULL,
  "image_id" uuid NOT NULL,
  "ocr_assisted" boolean DEFAULT false NOT NULL,
  "original_candidate" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_price_report_images_report_id_image_id_pk" PRIMARY KEY("report_id","image_id")
);

ALTER TABLE "report_images" ADD CONSTRAINT "report_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_image_ocr_results" ADD CONSTRAINT "report_image_ocr_results_report_image_id_report_images_id_fk" FOREIGN KEY ("report_image_id") REFERENCES "public"."report_images"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_price_report_images" ADD CONSTRAINT "user_price_report_images_report_id_user_price_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."user_price_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_price_report_images" ADD CONSTRAINT "user_price_report_images_image_id_report_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."report_images"("id") ON DELETE restrict ON UPDATE no action;

CREATE INDEX "report_images_user_created_idx" ON "report_images" USING btree ("user_id","created_at");
CREATE INDEX "report_images_status_created_idx" ON "report_images" USING btree ("status","created_at");
CREATE INDEX "report_images_sha256_user_idx" ON "report_images" USING btree ("sha256","user_id");
CREATE INDEX "report_images_station_idx" ON "report_images" USING btree ("station_id");
CREATE INDEX "report_image_ocr_results_image_idx" ON "report_image_ocr_results" USING btree ("report_image_id");
CREATE INDEX "user_price_report_images_image_idx" ON "user_price_report_images" USING btree ("image_id");
