import { resolve } from 'node:path';
import postgres from 'postgres';
import { sql, eq } from 'drizzle-orm';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { PostgresConnection } from '../../database/postgres.connection';
import { DATABASE_CLIENT } from '../../database/database.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../../database/schema';
import * as schemaTables from '../../database/schema';
import { seedFranceSource } from '../../database/seeds/france-source.seed';
import { seedGermanySource } from '../../database/seeds/germany-source.seed';
import { seedSpainSource } from '../../database/seeds/spain-source.seed';
import { AdvisoryLockError, providerLockKey } from './locking/advisory-lock';
import { IngestionService } from './ingestion.service';
import { FRANCE_PROVIDER_CODE } from './providers/france/france.constants';
import { SPAIN_PROVIDER_CODE } from './providers/spain/spain.constants';
import { GERMANY_PROVIDER_CODE } from './providers/germany/germany.constants';

const connectionString = process.env.DATABASE_URL;
const describeIfDb = connectionString ? describe : describe.skip;

const FRANCE_FIXTURE = resolve(
  __dirname,
  '../../../test/fixtures/france/instantaneous-small.json',
);
const SPAIN_FIXTURE = resolve(
  __dirname,
  '../../../test/fixtures/spain/terrestrial-small.json',
);
const GERMANY_FIXTURE = resolve(
  __dirname,
  '../../../test/fixtures/germany/stations-small.json',
);
const GERMANY_CHANGED_FIXTURE = resolve(
  __dirname,
  '../../../test/fixtures/germany/stations-changed-price.json',
);

async function resetProviderIngestionData(
  db: PostgresJsDatabase<typeof schema>,
  providerCode: string,
): Promise<void> {
  const source = await db.query.dataSources.findFirst({
    where: eq(schemaTables.dataSources.code, providerCode),
  });
  if (!source) {
    return;
  }

  await db
    .delete(schemaTables.fuelPriceObservations)
    .where(eq(schemaTables.fuelPriceObservations.dataSourceId, source.id));

  await db
    .delete(schemaTables.stationSourceMappings)
    .where(eq(schemaTables.stationSourceMappings.dataSourceId, source.id));
}

describeIfDb('France ingestion integration', () => {
  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    if (connectionString) {
      await seedFranceSource(connectionString);
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    ingestionService = moduleRef.get(IngestionService);
    db = moduleRef.get(DATABASE_CLIENT);
  });

  afterAll(async () => {
    const postgresConn = moduleRef.get(PostgresConnection);
    await postgresConn.onModuleDestroy();
    await moduleRef.close();
  });

  it('imports fixture stations with SRID 4326 and supports idempotent re-import', async () => {
    const first = await ingestionService.ingestFrance({
      fixturePath: FRANCE_FIXTURE,
    });
    expect(first.status).not.toBe('failed');
    expect(first.stationsCreated + first.stationsUpdated).toBeGreaterThan(0);

    const srids = await db.execute<{ srid: number }>(sql`
      SELECT DISTINCT ST_SRID(location) AS srid FROM stations
    `);
    expect(srids.every((row) => row.srid === 4326)).toBe(true);

    const second = await ingestionService.ingestFrance({
      fixturePath: FRANCE_FIXTURE,
    });
    expect(second.priceObservationsCreated).toBe(0);
    expect(second.stationsCreated).toBe(0);
  });

  it('prevents overlapping provider runs via advisory lock', async () => {
    const lockKey = providerLockKey(FRANCE_PROVIDER_CODE);
    const lockClient = postgres(connectionString!, { max: 1 });

    try {
      const [row] = await lockClient<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey}) AS acquired
      `;
      expect(row?.acquired).toBe(true);

      await expect(
        ingestionService.ingestFrance({ fixturePath: FRANCE_FIXTURE }),
      ).rejects.toBeInstanceOf(AdvisoryLockError);
    } finally {
      await lockClient`SELECT pg_advisory_unlock(${lockKey})`;
      await lockClient.end({ timeout: 5 });
    }
  });
});

describeIfDb('Spain ingestion integration', () => {
  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    if (connectionString) {
      await seedSpainSource(connectionString);
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    ingestionService = moduleRef.get(IngestionService);
    db = moduleRef.get(DATABASE_CLIENT);
  });

  afterAll(async () => {
    const postgresConn = moduleRef.get(PostgresConnection);
    await postgresConn.onModuleDestroy();
    await moduleRef.close();
  });

  it('imports Spain fixture with SRID 4326 and idempotent re-import', async () => {
    const first = await ingestionService.ingestSpain({
      fixturePath: SPAIN_FIXTURE,
    });
    expect(first.status).not.toBe('failed');
    expect(first.stationsCreated + first.stationsUpdated).toBeGreaterThan(0);

    const srids = await db.execute<{ srid: number }>(sql`
      SELECT DISTINCT ST_SRID(location) AS srid FROM stations
    `);
    expect(srids.every((row) => row.srid === 4326)).toBe(true);

    const second = await ingestionService.ingestSpain({
      fixturePath: SPAIN_FIXTURE,
    });
    expect(second.priceObservationsCreated).toBe(0);
    expect(second.stationsCreated).toBe(0);
  });

  it('prevents overlapping Spain runs via advisory lock', async () => {
    const lockKey = providerLockKey(SPAIN_PROVIDER_CODE);
    const lockClient = postgres(connectionString!, { max: 1 });

    try {
      const [row] = await lockClient<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey}) AS acquired
      `;
      expect(row?.acquired).toBe(true);

      await expect(
        ingestionService.ingestSpain({ fixturePath: SPAIN_FIXTURE }),
      ).rejects.toBeInstanceOf(AdvisoryLockError);
    } finally {
      await lockClient`SELECT pg_advisory_unlock(${lockKey})`;
      await lockClient.end({ timeout: 5 });
    }
  });
});

describeIfDb('Germany ingestion integration', () => {
  let moduleRef: TestingModule;
  let ingestionService: IngestionService;
  let db: PostgresJsDatabase<typeof schema>;

  beforeAll(async () => {
    if (connectionString) {
      await seedGermanySource(connectionString);
    }

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    ingestionService = moduleRef.get(IngestionService);
    db = moduleRef.get(DATABASE_CLIENT);
    await resetProviderIngestionData(db, GERMANY_PROVIDER_CODE);
  });

  afterAll(async () => {
    const postgresConn = moduleRef.get(PostgresConnection);
    await postgresConn.onModuleDestroy();
    await moduleRef.close();
  });

  it('imports Germany fixture with SRID 4326 and idempotent re-import', async () => {
    const first = await ingestionService.ingestGermany({
      fixturePath: GERMANY_FIXTURE,
    });
    expect(first.status).not.toBe('failed');
    expect(first.stationsCreated + first.stationsUpdated).toBeGreaterThan(0);
    expect(first.priceObservationsCreated).toBeGreaterThan(0);

    const srids = await db.execute<{ srid: number }>(sql`
      SELECT DISTINCT ST_SRID(s.location) AS srid
      FROM stations s
      INNER JOIN station_source_mappings m ON m.station_id = s.id
      INNER JOIN data_sources d ON d.id = m.data_source_id
      WHERE d.code = ${GERMANY_PROVIDER_CODE}
    `);
    expect(srids.every((row) => row.srid === 4326)).toBe(true);

    const second = await ingestionService.ingestGermany({
      fixturePath: GERMANY_FIXTURE,
    });
    expect(second.priceObservationsCreated).toBe(0);
    expect(second.stationsCreated).toBe(0);
  });

  it('creates new observations when Germany prices change', async () => {
    await ingestionService.ingestGermany({ fixturePath: GERMANY_FIXTURE });

    const changed = await ingestionService.ingestGermany({
      fixturePath: GERMANY_CHANGED_FIXTURE,
    });
    expect(changed.priceObservationsCreated).toBeGreaterThan(0);
  });

  it('prevents overlapping Germany runs via advisory lock', async () => {
    const lockKey = providerLockKey(GERMANY_PROVIDER_CODE);
    const lockClient = postgres(connectionString!, { max: 1 });

    try {
      const [row] = await lockClient<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey}) AS acquired
      `;
      expect(row?.acquired).toBe(true);

      await expect(
        ingestionService.ingestGermany({ fixturePath: GERMANY_FIXTURE }),
      ).rejects.toBeInstanceOf(AdvisoryLockError);
    } finally {
      await lockClient`SELECT pg_advisory_unlock(${lockKey})`;
      await lockClient.end({ timeout: 5 });
    }
  });
});
