DROP TABLE IF EXISTS "_fuelmap_meta";
--> statement-breakpoint
CREATE TYPE "public"."data_source_type" AS ENUM('official', 'commercial', 'fuel_chain', 'third_party', 'crowdsourced', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."fuel_category" AS ENUM('gasoline', 'diesel', 'gas', 'hydrogen', 'electric', 'other');
--> statement-breakpoint
CREATE TYPE "public"."fuel_unit" AS ENUM('liter', 'kilogram', 'kwh');
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2" text NOT NULL,
	"iso3" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ru" text,
	"is_eu_member" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"decimal_digits" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_currencies" (
	"country_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_primary" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "data_source_type" NOT NULL,
	"country_id" uuid,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"trust_weight" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"brand" text,
	"name" text,
	"address_line" text,
	"postal_code" text,
	"city" text,
	"location" geometry(point) NOT NULL,
	"phone" text,
	"website" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_source_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_station_id" text NOT NULL,
	"external_name" text,
	"external_brand" text,
	"raw_metadata" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ru" text,
	"category" "fuel_category" NOT NULL,
	"octane_rating" integer,
	"biofuel_percentage" integer,
	"unit" "fuel_unit" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid,
	"country_id" uuid,
	"external_code" text,
	"external_name" text NOT NULL,
	"fuel_type_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_fuels" (
	"station_id" uuid NOT NULL,
	"fuel_type_id" uuid NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"fuel_type_id" uuid NOT NULL,
	"data_source_id" uuid NOT NULL,
	"station_source_mapping_id" uuid,
	"price" numeric(12, 4) NOT NULL,
	"currency_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" numeric(5, 4),
	"is_user_report" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"quote_currency_id" uuid NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"rate_date" date NOT NULL,
	"data_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_currencies" ADD CONSTRAINT "country_currencies_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "country_currencies" ADD CONSTRAINT "country_currencies_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "station_source_mappings" ADD CONSTRAINT "station_source_mappings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "station_source_mappings" ADD CONSTRAINT "station_source_mappings_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_aliases" ADD CONSTRAINT "fuel_aliases_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_aliases" ADD CONSTRAINT "fuel_aliases_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_aliases" ADD CONSTRAINT "fuel_aliases_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "station_fuels" ADD CONSTRAINT "station_fuels_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "station_fuels" ADD CONSTRAINT "station_fuels_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_price_observations" ADD CONSTRAINT "fuel_price_observations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_price_observations" ADD CONSTRAINT "fuel_price_observations_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_price_observations" ADD CONSTRAINT "fuel_price_observations_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_price_observations" ADD CONSTRAINT "fuel_price_observations_station_source_mapping_id_station_source_mappings_id_fk" FOREIGN KEY ("station_source_mapping_id") REFERENCES "public"."station_source_mappings"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fuel_price_observations" ADD CONSTRAINT "fuel_price_observations_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_quote_currency_id_currencies_id_fk" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso2_unique" ON "countries" USING btree ("iso2");
--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso3_unique" ON "countries" USING btree ("iso3");
--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_unique" ON "currencies" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX "country_currencies_country_currency_unique" ON "country_currencies" USING btree ("country_id","currency_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_code_unique" ON "data_sources" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "stations_country_id_idx" ON "stations" USING btree ("country_id");
--> statement-breakpoint
CREATE INDEX "stations_city_idx" ON "stations" USING btree ("city");
--> statement-breakpoint
CREATE INDEX "stations_brand_idx" ON "stations" USING btree ("brand");
--> statement-breakpoint
CREATE INDEX "stations_location_gist_idx" ON "stations" USING gist ("location");
--> statement-breakpoint
CREATE UNIQUE INDEX "station_source_mappings_source_external_unique" ON "station_source_mappings" USING btree ("data_source_id","external_station_id");
--> statement-breakpoint
CREATE INDEX "station_source_mappings_station_id_idx" ON "station_source_mappings" USING btree ("station_id");
--> statement-breakpoint
CREATE INDEX "station_source_mappings_data_source_id_idx" ON "station_source_mappings" USING btree ("data_source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_types_code_unique" ON "fuel_types" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "fuel_aliases_fuel_type_id_idx" ON "fuel_aliases" USING btree ("fuel_type_id");
--> statement-breakpoint
CREATE INDEX "fuel_aliases_data_source_id_idx" ON "fuel_aliases" USING btree ("data_source_id");
--> statement-breakpoint
CREATE INDEX "fuel_aliases_country_id_idx" ON "fuel_aliases" USING btree ("country_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "station_fuels_station_fuel_unique" ON "station_fuels" USING btree ("station_id","fuel_type_id");
--> statement-breakpoint
CREATE INDEX "fuel_price_observations_station_fuel_observed_idx" ON "fuel_price_observations" USING btree ("station_id","fuel_type_id","observed_at");
--> statement-breakpoint
CREATE INDEX "fuel_price_observations_source_observed_idx" ON "fuel_price_observations" USING btree ("data_source_id","observed_at");
--> statement-breakpoint
CREATE INDEX "fuel_price_observations_observed_at_idx" ON "fuel_price_observations" USING btree ("observed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_base_quote_date_unique" ON "exchange_rates" USING btree ("base_currency_id","quote_currency_id","rate_date");
--> statement-breakpoint
CREATE INDEX "exchange_rates_rate_date_idx" ON "exchange_rates" USING btree ("rate_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "schema_metadata_key_unique" ON "schema_metadata" USING btree ("key");
