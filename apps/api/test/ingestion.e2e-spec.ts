import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface IngestionStatusSource {
  code: string;
  country: string | null;
  lastRun: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsFetched: number;
    stationsCreated: number;
    priceObservationsCreated: number;
    errorsCount: number;
  } | null;
}

interface IngestionStatusResponse {
  schedulerEnabled: boolean;
  sources: IngestionStatusSource[];
}

describe('Ingestion status (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ingestion/status returns safe summary for configured providers', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/ingestion/status')
      .expect(200);

    const body = response.body as IngestionStatusResponse;
    expect(body).toHaveProperty('sources');
    expect(body).toHaveProperty('schedulerEnabled');
    expect(typeof body.schedulerEnabled).toBe('boolean');
    expect(Array.isArray(body.sources)).toBe(true);

    const france = body.sources.find((s) => s.code === 'FR_GOV_FUEL_PRICES');
    const spain = body.sources.find((s) => s.code === 'ES_MITECO_FUEL_PRICES');
    const germany = body.sources.find((s) => s.code === 'DE_TANKERKOENIG_MTSK');
    expect(france).toBeDefined();
    expect(spain).toBeDefined();
    expect(germany).toBeDefined();
    expect(france?.country).toBe('FR');
    expect(spain?.country).toBe('ES');
    expect(germany?.country).toBe('DE');
    if (france?.lastRun) {
      expect(france.lastRun).not.toHaveProperty('rawPayload');
      expect(france.lastRun).toHaveProperty('status');
    }
  });
});
