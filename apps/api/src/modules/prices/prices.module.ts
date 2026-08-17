import { Module } from '@nestjs/common';
import { StationsModule } from '../stations/stations.module';
import { PriceSelectionModule } from './price-selection.module';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [StationsModule, PriceSelectionModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService, PriceSelectionModule],
})
export class PricesModule {}
