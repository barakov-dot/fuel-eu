DO $$ BEGIN
  CREATE TYPE "price_service_mode" AS ENUM ('self', 'served', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "fuel_price_observations"
  ADD COLUMN IF NOT EXISTS "service_mode" "price_service_mode" NOT NULL DEFAULT 'unknown';

DROP INDEX IF EXISTS "fuel_price_observations_ingestion_dedup_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "fuel_price_observations_ingestion_dedup_unique"
  ON "fuel_price_observations" (
    "station_source_mapping_id",
    "fuel_type_id",
    "service_mode",
    "observed_at",
    "price",
    "currency_id"
  );
