import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import {
  DEFAULT_PRICE_HISTORY_LIMIT,
  MAX_PRICE_HISTORY_LIMIT,
} from './prices.constants';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceCandidateQueryService } from './price-candidate-query.service';
import { PriceSelectionService } from './price-selection.service';
import { mapSelectedPriceToLatestApi } from './selected-price.mapper';

@Injectable()
export class PricesService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly priceCandidateQuery: PriceCandidateQueryService,
    private readonly priceSelection: PriceSelectionService,
  ) {}

  async findLatestByStation(stationId: string) {
    const candidates =
      await this.priceCandidateQuery.fetchCandidatesForStations([stationId]);
    const selected = this.priceSelection.selectBestByStationAndFuel(candidates);

    const results = Array.from(selected.values()).map((price) =>
      mapSelectedPriceToLatestApi(price),
    );

    results.sort((a, b) => a.fuelCode.localeCompare(b.fuelCode));
    return results;
  }

  async findHistoryByStation(stationId: string, query: PriceHistoryQueryDto) {
    const limit = Math.min(
      query.limit ?? DEFAULT_PRICE_HISTORY_LIMIT,
      MAX_PRICE_HISTORY_LIMIT,
    );

    const conditions = [
      eq(schema.fuelPriceObservations.stationId, stationId),
      eq(schema.fuelPriceObservations.fuelTypeId, query.fuelTypeId),
    ];

    if (query.from) {
      conditions.push(
        gte(schema.fuelPriceObservations.observedAt, new Date(query.from)),
      );
    }

    if (query.to) {
      conditions.push(
        lte(schema.fuelPriceObservations.observedAt, new Date(query.to)),
      );
    }

    const rows = await this.db
      .select({
        id: schema.fuelPriceObservations.id,
        stationId: schema.fuelPriceObservations.stationId,
        fuelTypeId: schema.fuelPriceObservations.fuelTypeId,
        fuelCode: schema.fuelTypes.code,
        dataSourceId: schema.fuelPriceObservations.dataSourceId,
        dataSourceCode: schema.dataSources.code,
        dataSourceType: schema.dataSources.type,
        price: schema.fuelPriceObservations.price,
        currencyId: schema.fuelPriceObservations.currencyId,
        currencyCode: schema.currencies.code,
        observedAt: schema.fuelPriceObservations.observedAt,
        receivedAt: schema.fuelPriceObservations.receivedAt,
        serviceMode: schema.fuelPriceObservations.serviceMode,
        confidence: schema.fuelPriceObservations.confidence,
        isUserReport: schema.fuelPriceObservations.isUserReport,
      })
      .from(schema.fuelPriceObservations)
      .innerJoin(
        schema.fuelTypes,
        eq(schema.fuelPriceObservations.fuelTypeId, schema.fuelTypes.id),
      )
      .innerJoin(
        schema.dataSources,
        eq(schema.fuelPriceObservations.dataSourceId, schema.dataSources.id),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.fuelPriceObservations.currencyId, schema.currencies.id),
      )
      .where(and(...conditions))
      .orderBy(asc(schema.fuelPriceObservations.observedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      stationId: row.stationId,
      fuelTypeId: row.fuelTypeId,
      fuelCode: row.fuelCode,
      dataSourceId: row.dataSourceId,
      dataSourceCode: row.dataSourceCode,
      dataSourceType: row.dataSourceType,
      price: String(row.price),
      currencyId: row.currencyId,
      currencyCode: row.currencyCode,
      observedAt: row.observedAt,
      receivedAt: row.receivedAt,
      serviceMode: row.serviceMode,
      confidence: row.confidence ? String(row.confidence) : null,
      isUserReport: row.isUserReport,
    }));
  }
}
