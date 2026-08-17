import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceSelectionModule } from '../prices/price-selection.module';
import { ROUTING_PROVIDER_TOKEN } from './routing.constants';
import { MockRoutingProvider } from './providers/mock/mock-routing.provider';
import { OsrmRoutingProvider } from './providers/osrm/osrm.provider';
import { RouteCorridorService } from './route-corridor.service';
import { RouteStationsService } from './route-stations.service';
import { RoutingController } from './routing.controller';
import { RoutingCacheService, RoutingService } from './routing.service';
import { SavingsCalculatorService } from './savings-calculator.service';
import type { RoutingProvider } from './routing-provider.interface';

function createRoutingProvider(configService: ConfigService): RoutingProvider {
  const provider = configService.get<string>('ROUTING_PROVIDER') ?? 'osrm';
  if (provider === 'mock') {
    return new MockRoutingProvider();
  }
  return new OsrmRoutingProvider(configService);
}

@Module({
  imports: [PriceSelectionModule],
  controllers: [RoutingController],
  providers: [
    {
      provide: ROUTING_PROVIDER_TOKEN,
      inject: [ConfigService],
      useFactory: createRoutingProvider,
    },
    OsrmRoutingProvider,
    RoutingCacheService,
    RoutingService,
    RouteCorridorService,
    RouteStationsService,
    SavingsCalculatorService,
  ],
  exports: [RoutingService, RouteCorridorService, SavingsCalculatorService],
})
export class RoutingModule {}
