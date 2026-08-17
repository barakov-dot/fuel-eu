import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsOptional()
  @IsString()
  POSTGRES_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  POSTGRES_PORT?: number;

  @IsOptional()
  @IsString()
  INGESTION_SCHEDULER_ENABLED?: string;

  @IsOptional()
  @IsString()
  INGESTION_RUN_ON_STARTUP?: string;

  @IsOptional()
  @IsString()
  FRANCE_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  SPAIN_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  SPAIN_FUEL_API_URL?: string;

  @IsOptional()
  @IsString()
  TANKERKOENIG_API_KEY?: string;

  @IsOptional()
  @IsString()
  TANKERKOENIG_BASE_URL?: string;

  @IsOptional()
  @IsString()
  GERMANY_STATIONS_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  GERMANY_PRICES_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  ITALY_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  ITALY_STATIONS_URL?: string;

  @IsOptional()
  @IsString()
  ITALY_PRICES_URL?: string;

  @IsOptional()
  @IsString()
  SLOVENIA_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  SLOVENIA_SEARCH_API_URL?: string;

  @IsOptional()
  @IsString()
  SLOVENIA_FRANCHISE_API_URL?: string;

  @IsOptional()
  @IsString()
  CROATIA_INGEST_CRON?: string;

  @IsOptional()
  @IsString()
  CROATIA_DATA_URL?: string;

  @IsOptional()
  @IsString()
  GERMANY_SYNC_MODE?: string;

  @IsOptional()
  @IsString()
  GERMANY_GRID_MAX_POINTS?: string;

  @IsOptional()
  @IsString()
  ROUTING_PROVIDER?: string;

  @IsOptional()
  @IsString()
  OSRM_BASE_URL?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(120_000)
  OSRM_TIMEOUT_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  ROUTING_CACHE_TTL_SECONDS?: number;

  @IsOptional()
  @IsString()
  GEOCODING_PROVIDER?: string;

  @IsOptional()
  @IsString()
  NOMINATIM_BASE_URL?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(120_000)
  NOMINATIM_TIMEOUT_MS?: number;

  @IsOptional()
  @IsString()
  NOMINATIM_CONTACT_EMAIL?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000)
  NOMINATIM_MIN_INTERVAL_MS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(604_800)
  GEOCODING_CACHE_TTL_SECONDS?: number;

  @IsOptional()
  @IsString()
  WEB_ORIGIN?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  AUTH_COOKIE_NAME?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3600)
  @Max(31_536_000)
  AUTH_SESSION_TTL_SECONDS?: number;

  @IsOptional()
  @IsString()
  IMAGE_STORAGE_PATH?: string;

  @IsOptional()
  @IsString()
  OCR_PROVIDER?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  OCR_MAX_CONCURRENCY?: number;

  @IsOptional()
  @IsString()
  API_GLOBAL_PREFIX?: string;

  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  @IsOptional()
  @IsString()
  APP_VERSION?: string;

  @IsOptional()
  @IsString()
  GIT_SHA?: string;

  @IsOptional()
  @IsString()
  TESSERACT_CACHE_PATH?: string;
}
