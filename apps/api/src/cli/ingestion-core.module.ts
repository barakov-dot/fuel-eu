import { Module } from '@nestjs/common';
import { ApplicationCoreModule } from './application-core.module';
import { PriceSelectionModule } from '../modules/prices/price-selection.module';
import { IngestionLockService } from '../modules/ingestion/locking/advisory-lock';
import { IngestionRunService } from '../modules/ingestion/ingestion-run.service';
import { IngestionService } from '../modules/ingestion/ingestion.service';
import { IngestionWriterService } from '../modules/ingestion/ingestion-writer.service';
import { AustriaSpritClient } from '../modules/ingestion/providers/austria/austria.client';
import { AustriaFuelPriceProvider } from '../modules/ingestion/providers/austria/austria.provider';
import { AustriaOnDemandEnrichmentService } from '../modules/ingestion/providers/austria/austria-on-demand.service';
import { FranceFuelPriceProvider } from '../modules/ingestion/providers/france/france.provider';
import { GermanyFuelPriceProvider } from '../modules/ingestion/providers/germany/germany.provider';
import { ItalyFuelPriceProvider } from '../modules/ingestion/providers/italy/italy.provider';
import { SloveniaFuelPriceProvider } from '../modules/ingestion/providers/slovenia/slovenia.provider';
import { CroatiaFuelPriceProvider } from '../modules/ingestion/providers/croatia/croatia.provider';
import { SpainFuelPriceProvider } from '../modules/ingestion/providers/spain/spain.provider';

@Module({
  imports: [ApplicationCoreModule, PriceSelectionModule],
  providers: [
    IngestionService,
    IngestionRunService,
    IngestionWriterService,
    IngestionLockService,
    FranceFuelPriceProvider,
    SpainFuelPriceProvider,
    GermanyFuelPriceProvider,
    AustriaSpritClient,
    AustriaFuelPriceProvider,
    AustriaOnDemandEnrichmentService,
    ItalyFuelPriceProvider,
    SloveniaFuelPriceProvider,
    CroatiaFuelPriceProvider,
  ],
  exports: [
    IngestionService,
    IngestionRunService,
    IngestionWriterService,
    AustriaOnDemandEnrichmentService,
  ],
})
export class IngestionCoreModule {}
