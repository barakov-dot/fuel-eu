import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import { wgs84Point } from '../../database/geometry';
import * as schema from '../../database/schema';
import { CrowdsourcedReconciliationService } from '../crowdsourcing/crowdsourced-reconciliation.service';
import type { NormalizedStationRecord } from './types/ingestion.types';
import type {
  ProviderImportContext,
  ProviderImportResult,
  ProviderRecordError,
} from './providers/fuel-price-provider.interface';

const BATCH_SIZE = 50;

type LatestPriceKey = `${string}:${string}:${string}`;

@Injectable()
export class IngestionWriterService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Optional()
    private readonly reconciliationService?: CrowdsourcedReconciliationService,
  ) {}

  async importStations(
    stations: NormalizedStationRecord[],
    context: ProviderImportContext,
  ): Promise<ProviderImportResult> {
    const stats = {
      recordsFetched: stations.length,
      stationsCreated: 0,
      stationsUpdated: 0,
      mappingsCreated: 0,
      priceObservationsCreated: 0,
      recordsSkipped: 0,
      errorsCount: 0,
    };
    const errors: ProviderRecordError[] = [];

    if (context.dryRun) {
      const priceCount = stations.reduce(
        (sum, s) => sum + s.fuelPrices.length,
        0,
      );
      return {
        stats: {
          recordsFetched: stations.length,
          stationsCreated: stations.length,
          stationsUpdated: 0,
          mappingsCreated: stations.length,
          priceObservationsCreated: priceCount,
          recordsSkipped: 0,
          errorsCount: 0,
        },
        errors,
        metadata: { dryRun: true, normalizedStations: stations.length },
      };
    }

    const reconciliationQueue: Array<{
      stationId: string;
      fuelTypeId: string;
      currencyId: string;
      price: string;
      observedAt: Date;
    }> = [];

    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);
      const batchResult = await this.db.transaction(async (tx) =>
        this.processBatch(tx, batch, context),
      );
      stats.stationsCreated += batchResult.stationsCreated;
      stats.stationsUpdated += batchResult.stationsUpdated;
      stats.mappingsCreated += batchResult.mappingsCreated;
      stats.priceObservationsCreated += batchResult.priceObservationsCreated;
      stats.errorsCount += batchResult.errors.length;
      errors.push(...batchResult.errors);
      reconciliationQueue.push(...batchResult.reconciliationCandidates);
    }

    if (this.reconciliationService) {
      for (const candidate of reconciliationQueue) {
        await this.reconciliationService.reconcileAfterOfficialObservation(
          candidate.stationId,
          candidate.fuelTypeId,
          candidate.currencyId,
          candidate.price,
          candidate.observedAt,
        );
      }
    }

    return { stats, errors, metadata: {} };
  }

  private async processBatch(
    tx: PostgresJsDatabase<typeof schema>,
    batch: NormalizedStationRecord[],
    context: ProviderImportContext,
  ): Promise<{
    stationsCreated: number;
    stationsUpdated: number;
    mappingsCreated: number;
    priceObservationsCreated: number;
    errors: ProviderRecordError[];
    reconciliationCandidates: Array<{
      stationId: string;
      fuelTypeId: string;
      currencyId: string;
      price: string;
      observedAt: Date;
    }>;
  }> {
    const now = new Date();
    const errors: ProviderRecordError[] = [];
    let stationsCreated = 0;
    let stationsUpdated = 0;
    let mappingsCreated = 0;
    let priceObservationsCreated = 0;

    const externalIds = batch.map((s) => s.externalStationId);
    const existingMappings = await tx
      .select()
      .from(schema.stationSourceMappings)
      .where(
        and(
          eq(schema.stationSourceMappings.dataSourceId, context.dataSourceId),
          inArray(schema.stationSourceMappings.externalStationId, externalIds),
        ),
      );

    const mappingByExternalId = new Map(
      existingMappings.map((m) => [m.externalStationId, m]),
    );

    const stationIdByExternalId = new Map<string, string>();
    const mappingIdByExternalId = new Map<string, string>();

    for (const station of batch) {
      const existing = mappingByExternalId.get(station.externalStationId);
      if (existing) {
        stationIdByExternalId.set(
          station.externalStationId,
          existing.stationId,
        );
        mappingIdByExternalId.set(station.externalStationId, existing.id);

        if (!station.priceUpdateOnly) {
          const updates: Partial<typeof schema.stations.$inferInsert> = {};
          if (station.addressLine) updates.addressLine = station.addressLine;
          if (station.postalCode) updates.postalCode = station.postalCode;
          if (station.city) updates.city = station.city;
          if (station.name) updates.name = station.name;
          if (station.brand) updates.brand = station.brand;

          const hasCoords =
            station.lon !== undefined &&
            station.lat !== undefined &&
            Number.isFinite(station.lon) &&
            Number.isFinite(station.lat);

          if (Object.keys(updates).length > 0 || hasCoords) {
            await tx
              .update(schema.stations)
              .set({
                ...updates,
                ...(hasCoords
                  ? { location: wgs84Point(station.lon!, station.lat!) }
                  : {}),
                updatedAt: now,
              })
              .where(eq(schema.stations.id, existing.stationId));
            stationsUpdated++;
          }

          await tx
            .update(schema.stationSourceMappings)
            .set({
              lastSeenAt: now,
              externalName: station.name ?? existing.externalName,
              externalBrand: station.brand ?? existing.externalBrand,
              rawMetadata: station.rawMetadata ?? existing.rawMetadata,
              updatedAt: now,
            })
            .where(eq(schema.stationSourceMappings.id, existing.id));
        }
      }
    }

    const newStations = batch.filter(
      (s) =>
        !mappingByExternalId.has(s.externalStationId) && !s.priceUpdateOnly,
    );

    if (newStations.length > 0) {
      const insertableStations = newStations.filter(
        (station) =>
          station.lon !== undefined &&
          station.lat !== undefined &&
          Number.isFinite(station.lon) &&
          Number.isFinite(station.lat),
      );

      if (insertableStations.length < newStations.length) {
        for (const station of newStations) {
          if (
            station.lon === undefined ||
            station.lat === undefined ||
            !Number.isFinite(station.lon) ||
            !Number.isFinite(station.lat)
          ) {
            errors.push({
              externalRecordId: station.externalStationId,
              errorCode: 'INVALID_COORDINATES',
              message: 'Cannot create station without coordinates',
            });
          }
        }
      }

      if (insertableStations.length === 0) {
        // No new stations to insert; continue with price updates for existing mappings.
      } else {
        const insertedStations = await tx
          .insert(schema.stations)
          .values(
            insertableStations.map((station) => ({
              countryId: context.countryId,
              brand: station.brand,
              name: station.name,
              addressLine: station.addressLine,
              postalCode: station.postalCode,
              city: station.city,
              location: wgs84Point(station.lon!, station.lat!),
              isActive: true,
            })),
          )
          .returning({
            id: schema.stations.id,
          });

        const insertedMappings = await tx
          .insert(schema.stationSourceMappings)
          .values(
            insertableStations.map((station, index) => ({
              stationId: insertedStations[index].id,
              dataSourceId: context.dataSourceId,
              externalStationId: station.externalStationId,
              externalName: station.name,
              externalBrand: station.brand,
              rawMetadata: station.rawMetadata,
              firstSeenAt: now,
              lastSeenAt: now,
            })),
          )
          .returning({
            id: schema.stationSourceMappings.id,
            externalStationId: schema.stationSourceMappings.externalStationId,
            stationId: schema.stationSourceMappings.stationId,
          });

        for (const mapping of insertedMappings) {
          stationIdByExternalId.set(
            mapping.externalStationId,
            mapping.stationId,
          );
          mappingIdByExternalId.set(mapping.externalStationId, mapping.id);
        }

        stationsCreated += insertableStations.length;
        mappingsCreated += insertableStations.length;
      }
    }

    const stationIds = [...new Set(stationIdByExternalId.values())];
    const latestPriceMap =
      context.observationDedupStrategy === 'price-change-only'
        ? await this.loadLatestPrices(tx, stationIds)
        : undefined;

    const observationRows: Array<
      typeof schema.fuelPriceObservations.$inferInsert
    > = [];
    const stationFuelRows: Array<typeof schema.stationFuels.$inferInsert> = [];

    for (const station of batch) {
      const stationId = stationIdByExternalId.get(station.externalStationId);
      const mappingId = mappingIdByExternalId.get(station.externalStationId);
      if (!stationId || !mappingId) {
        errors.push({
          externalRecordId: station.externalStationId,
          errorCode: 'DB_WRITE_FAILED',
          message: 'Station mapping missing after upsert',
        });
        continue;
      }

      for (const fuelPrice of station.fuelPrices) {
        if (
          latestPriceMap &&
          this.isUnchangedPrice(
            latestPriceMap,
            stationId,
            fuelPrice.fuelTypeId,
            fuelPrice.serviceMode ?? 'unknown',
            fuelPrice.price,
          )
        ) {
          stationFuelRows.push({
            stationId,
            fuelTypeId: fuelPrice.fuelTypeId,
            isAvailable: true,
            lastSeenAt: now,
          });
          continue;
        }

        observationRows.push({
          stationId,
          fuelTypeId: fuelPrice.fuelTypeId,
          dataSourceId: context.dataSourceId,
          stationSourceMappingId: mappingId,
          price: fuelPrice.price,
          currencyId: context.currencyId,
          observedAt: fuelPrice.observedAt,
          serviceMode: fuelPrice.serviceMode ?? 'unknown',
          receivedAt: now,
        });

        stationFuelRows.push({
          stationId,
          fuelTypeId: fuelPrice.fuelTypeId,
          isAvailable: true,
          lastSeenAt: now,
        });
      }
    }

    const reconciliationCandidates: Array<{
      stationId: string;
      fuelTypeId: string;
      currencyId: string;
      price: string;
      observedAt: Date;
    }> = [];

    if (observationRows.length > 0) {
      const inserted = await tx
        .insert(schema.fuelPriceObservations)
        .values(observationRows)
        .onConflictDoNothing({
          target: [
            schema.fuelPriceObservations.stationSourceMappingId,
            schema.fuelPriceObservations.fuelTypeId,
            schema.fuelPriceObservations.serviceMode,
            schema.fuelPriceObservations.observedAt,
            schema.fuelPriceObservations.price,
            schema.fuelPriceObservations.currencyId,
          ],
        })
        .returning({
          id: schema.fuelPriceObservations.id,
          stationId: schema.fuelPriceObservations.stationId,
          fuelTypeId: schema.fuelPriceObservations.fuelTypeId,
          currencyId: schema.fuelPriceObservations.currencyId,
          price: schema.fuelPriceObservations.price,
          observedAt: schema.fuelPriceObservations.observedAt,
        });

      priceObservationsCreated += inserted.length;

      for (const row of inserted) {
        reconciliationCandidates.push({
          stationId: row.stationId,
          fuelTypeId: row.fuelTypeId,
          currencyId: row.currencyId,
          price: String(row.price),
          observedAt: row.observedAt,
        });
      }
    }

    if (stationFuelRows.length > 0) {
      const uniqueStationFuels = [
        ...new Map(
          stationFuelRows.map((row) => [
            `${row.stationId}:${row.fuelTypeId}`,
            row,
          ]),
        ).values(),
      ];

      await tx
        .insert(schema.stationFuels)
        .values(uniqueStationFuels)
        .onConflictDoUpdate({
          target: [
            schema.stationFuels.stationId,
            schema.stationFuels.fuelTypeId,
          ],
          set: { isAvailable: true, lastSeenAt: now },
        });
    }

    return {
      stationsCreated,
      stationsUpdated,
      mappingsCreated,
      priceObservationsCreated,
      errors,
      reconciliationCandidates,
    };
  }

  private isUnchangedPrice(
    latestPriceMap: Map<LatestPriceKey, string>,
    stationId: string,
    fuelTypeId: string,
    serviceMode: string,
    price: string,
  ): boolean {
    const key: LatestPriceKey = `${stationId}:${fuelTypeId}:${serviceMode}`;
    return latestPriceMap.get(key) === price;
  }

  private async loadLatestPrices(
    tx: PostgresJsDatabase<typeof schema>,
    stationIds: string[],
  ): Promise<Map<LatestPriceKey, string>> {
    const result = new Map<LatestPriceKey, string>();
    if (stationIds.length === 0) {
      return result;
    }

    const rows = await tx
      .selectDistinctOn(
        [
          schema.fuelPriceObservations.stationId,
          schema.fuelPriceObservations.fuelTypeId,
          schema.fuelPriceObservations.serviceMode,
        ],
        {
          stationId: schema.fuelPriceObservations.stationId,
          fuelTypeId: schema.fuelPriceObservations.fuelTypeId,
          serviceMode: schema.fuelPriceObservations.serviceMode,
          price: schema.fuelPriceObservations.price,
        },
      )
      .from(schema.fuelPriceObservations)
      .where(inArray(schema.fuelPriceObservations.stationId, stationIds))
      .orderBy(
        schema.fuelPriceObservations.stationId,
        schema.fuelPriceObservations.fuelTypeId,
        schema.fuelPriceObservations.serviceMode,
        desc(schema.fuelPriceObservations.observedAt),
      );

    for (const row of rows) {
      result.set(
        `${row.stationId}:${row.fuelTypeId}:${row.serviceMode}`,
        row.price,
      );
    }

    return result;
  }

  async loadFuelAliasMap(
    dataSourceId: string,
    countryId: string,
  ): Promise<Map<string, string>> {
    const aliases = await this.db
      .select({
        externalName: schema.fuelAliases.externalName,
        fuelTypeId: schema.fuelAliases.fuelTypeId,
      })
      .from(schema.fuelAliases)
      .where(
        and(
          eq(schema.fuelAliases.dataSourceId, dataSourceId),
          eq(schema.fuelAliases.countryId, countryId),
        ),
      );

    return new Map(aliases.map((a) => [a.externalName, a.fuelTypeId]));
  }

  async loadDataSource(code: string) {
    return this.db.query.dataSources.findFirst({
      where: eq(schema.dataSources.code, code),
      with: { country: true },
    });
  }

  async loadExternalStationIds(dataSourceId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        externalStationId: schema.stationSourceMappings.externalStationId,
      })
      .from(schema.stationSourceMappings)
      .where(eq(schema.stationSourceMappings.dataSourceId, dataSourceId));

    return rows.map((row) => row.externalStationId);
  }

  async loadPrimaryCurrency(countryId: string) {
    const row = await this.db
      .select({
        currencyId: schema.countryCurrencies.currencyId,
        code: schema.currencies.code,
      })
      .from(schema.countryCurrencies)
      .innerJoin(
        schema.currencies,
        eq(schema.countryCurrencies.currencyId, schema.currencies.id),
      )
      .where(
        and(
          eq(schema.countryCurrencies.countryId, countryId),
          eq(schema.countryCurrencies.isPrimary, true),
          sql`${schema.countryCurrencies.validTo} IS NULL`,
        ),
      )
      .limit(1);

    return row[0] ?? null;
  }
}
