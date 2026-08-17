import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEOCODING_PROVIDER_TOKEN } from './geocoding.constants';
import { GeocodingController } from './geocoding.controller';
import { GeocodingCacheService, GeocodingService } from './geocoding.service';
import { MockGeocodingProvider } from './providers/mock/mock-geocoding.provider';
import { NominatimGeocodingProvider } from './providers/nominatim/nominatim.provider';
import type { GeocodingProvider } from './geocoding-provider.interface';

function createGeocodingProvider(
  configService: ConfigService,
): GeocodingProvider {
  const provider =
    configService.get<string>('GEOCODING_PROVIDER') ?? 'nominatim';

  if (provider === 'mock') {
    return new MockGeocodingProvider();
  }

  return new NominatimGeocodingProvider(configService);
}

@Module({
  controllers: [GeocodingController],
  providers: [
    {
      provide: GEOCODING_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: createGeocodingProvider,
    },
    NominatimGeocodingProvider,
    GeocodingCacheService,
    GeocodingService,
  ],
  exports: [GeocodingService],
})
export class GeocodingModule {}
