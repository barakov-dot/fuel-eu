import { Module } from '@nestjs/common';
import { PriceCandidateQueryService } from './price-candidate-query.service';
import { PriceSelectionService } from './price-selection.service';
import { SelectedPriceMapperService } from './selected-price.mapper';

@Module({
  providers: [
    PriceSelectionService,
    PriceCandidateQueryService,
    SelectedPriceMapperService,
  ],
  exports: [
    PriceSelectionService,
    PriceCandidateQueryService,
    SelectedPriceMapperService,
  ],
})
export class PriceSelectionModule {}
