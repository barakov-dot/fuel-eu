import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/validate-env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CountriesModule } from './modules/countries/countries.module';
import { FuelsModule } from './modules/fuels/fuels.module';
import { PricesModule } from './modules/prices/prices.module';
import { CoverageModule } from './modules/coverage/coverage.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SourcesModule } from './modules/sources/sources.module';
import { StationsModule } from './modules/stations/stations.module';
import { RoutingModule } from './modules/routing/routing.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { UsersModule } from './modules/users/users.module';
import { CrowdsourcingModule } from './modules/crowdsourcing/crowdsourcing.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate,
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CrowdsourcingModule,
    OcrModule,
    CountriesModule,
    FuelsModule,
    StationsModule,
    RoutingModule,
    GeocodingModule,
    PricesModule,
    IngestionModule,
    CoverageModule,
    SourcesModule,
  ],
})
export class AppModule {}
