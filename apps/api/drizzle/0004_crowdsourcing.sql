CREATE TYPE "public"."user_price_report_status" AS ENUM('pending', 'accepted', 'disputed', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."user_price_report_vote" AS ENUM('confirm', 'dispute');--> statement-breakpoint
CREATE TYPE "public"."user_reputation_event_type" AS ENUM('report_submitted', 'report_confirmed', 'report_disputed', 'report_matched_official', 'report_rejected', 'abuse_penalty');--> statement-breakpoint
CREATE TABLE "user_price_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"station_id" uuid NOT NULL,
	"fuel_type_id" uuid NOT NULL,
	"price" numeric(12, 4) NOT NULL,
	"currency_id" uuid NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "user_price_report_status" DEFAULT 'pending' NOT NULL,
	"confidence_score" numeric(5, 4) NOT NULL,
	"source_observation_id" uuid,
	"superseded_by_report_id" uuid,
	"distance_from_station_meters" integer,
	"comment" text,
	"moderation_reason" text
);--> statement-breakpoint
CREATE TABLE "user_price_report_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote" "user_price_report_vote" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "user_reputation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "user_reputation_event_type" NOT NULL,
	"points" integer NOT NULL,
	"related_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);--> statement-breakpoint
CREATE TABLE "user_reputation" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"score" integer DEFAULT 50 NOT NULL,
	"accepted_reports_count" integer DEFAULT 0 NOT NULL,
	"confirmed_reports_count" integer DEFAULT 0 NOT NULL,
	"rejected_reports_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_fuel_type_id_fuel_types_id_fk" FOREIGN KEY ("fuel_type_id") REFERENCES "public"."fuel_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_source_observation_id_fuel_price_observations_id_fk" FOREIGN KEY ("source_observation_id") REFERENCES "public"."fuel_price_observations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_report_votes" ADD CONSTRAINT "user_price_report_votes_report_id_user_price_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."user_price_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_price_report_votes" ADD CONSTRAINT "user_price_report_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation_events" ADD CONSTRAINT "user_reputation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation_events" ADD CONSTRAINT "user_reputation_events_related_report_id_user_price_reports_id_fk" FOREIGN KEY ("related_report_id") REFERENCES "public"."user_price_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation" ADD CONSTRAINT "user_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_price_reports_station_fuel_reported_idx" ON "user_price_reports" USING btree ("station_id","fuel_type_id","reported_at");--> statement-breakpoint
CREATE INDEX "user_price_reports_user_created_idx" ON "user_price_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_price_reports_status_idx" ON "user_price_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_price_report_votes_report_user_unique" ON "user_price_report_votes" USING btree ("report_id","user_id");--> statement-breakpoint
CREATE INDEX "user_price_report_votes_report_idx" ON "user_price_report_votes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "user_reputation_events_user_created_idx" ON "user_reputation_events" USING btree ("user_id","created_at");
