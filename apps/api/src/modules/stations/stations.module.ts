import { Module } from '@nestjs/common';
import { IngestionCoreModule } from '../../cli/ingestion-core.module';
import { CoverageModule } from '../coverage/coverage.module';
import { PriceSelectionModule } from '../prices/price-selection.module';
import { StationsController } from './stations.controller';
import { StationsQueryService } from './stations-query.service';
import { StationsService } from './stations.service';

@Module({
  imports: [PriceSelectionModule, IngestionCoreModule, CoverageModule],
  controllers: [StationsController],
  providers: [StationsService, StationsQueryService],
  exports: [StationsService, StationsQueryService],
})
export class StationsModule {}
