import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEV_IDS } from '../src/database/seeds/dev-data';
import { ROUTING_PROVIDER_TOKEN } from '../src/modules/routing/routing.constants';
import { MockRoutingProvider } from '../src/modules/routing/providers/mock/mock-routing.provider';
import { GEOCODING_PROVIDER_TOKEN } from '../src/modules/geocoding/geocoding.constants';
import { MockGeocodingProvider } from '../src/modules/geocoding/providers/mock/mock-geocoding.provider';
import { OCR_PROVIDER } from '../src/modules/ocr/ocr-provider.interface';
import { MockOcrProvider } from '../src/modules/ocr/providers/mock/mock-ocr.provider';
import {
  createInvalidUploadBuffer,
  createTestBoardPng,
} from './fixtures/report-image-fixtures';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('Report images + OCR API (e2e)', () => {
  let app: INestApplication<App>;
  let storageDir: string;
  let dieselFuelTypeId: string;
  let e10FuelTypeId: string;
  const password = 'valid-passphrase-12';
  const userEmail = `photo-${Date.now()}@example.invalid`;
  const otherEmail = `photo-other-${Date.now()}@example.invalid`;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'fuelmap-report-images-'));
    process.env.ROUTING_PROVIDER = 'mock';
    process.env.GEOCODING_PROVIDER = 'mock';
    process.env.WEB_ORIGIN = 'http://localhost:3000';
    process.env.IMAGE_STORAGE_PATH = storageDir;
    process.env.OCR_MAX_CONCURRENCY = '1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ROUTING_PROVIDER_TOKEN)
      .useValue(new MockRoutingProvider())
      .overrideProvider(GEOCODING_PROVIDER_TOKEN)
      .useValue(new MockGeocodingProvider())
      .overrideProvider(OCR_PROVIDER)
      .useValue(new MockOcrProvider())
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    const fuelsRes = await request(app.getHttpServer())
      .get('/fuel-types')
      .expect(200);
    const fuels = fuelsRes.body as Array<{ id: string; code: string }>;
    dieselFuelTypeId = fuels.find((fuel) => fuel.code === 'diesel')!.id;
    e10FuelTypeId = fuels.find((fuel) => fuel.code === 'e10')!.id;
  });

  afterAll(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  async function registerAgent(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ email, password, displayName: email })
      .expect(201);
    return agent;
  }

  it('rejects unauthenticated upload', async () => {
    const png = await createTestBoardPng();
    await request(app.getHttpServer())
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/report-images`)
      .attach('image', png, 'board.png')
      .expect(401);
  });

  it('uploads PNG, processes OCR candidates, confirms report with photo evidence', async () => {
    const agent = await registerAgent(userEmail);
    const png = await createTestBoardPng();

    const uploadRes = await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/report-images`)
      .attach('image', png, 'board.png')
      .expect(201);

    const uploadBody = uploadRes.body as { id: string };
    const imageId = uploadBody.id;
    expect(imageId).toBeTruthy();

    let statusBody: { status: string; candidates: unknown[] } | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const statusRes = await agent
        .get(`/report-images/${imageId}`)
        .expect(200);
      const body = statusRes.body as { status: string; candidates: unknown[] };
      statusBody = body;
      if (body.status === 'processed' || body.status === 'failed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    expect(statusBody).not.toBeNull();
    expect(statusBody!.status).toBe('processed');
    expect(statusBody!.candidates?.length).toBeGreaterThan(0);

    const reportRes = await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: dieselFuelTypeId,
        price: '1.6790',
        currency: 'EUR',
        reportImageId: imageId,
        ocrAssisted: true,
        originalCandidate: {
          fuelCodeSuggestion: (
            statusBody!.candidates?.[0] as { fuelCodeSuggestion?: string }
          )?.fuelCodeSuggestion,
          price: (statusBody!.candidates?.[0] as { price?: string })?.price,
        },
      })
      .expect(201);

    const reportBody = reportRes.body as {
      evidence: { hasPhoto: boolean; ocrAssisted: boolean };
    };
    expect(reportBody.evidence).toEqual({
      hasPhoto: true,
      ocrAssisted: true,
    });

    await request(app.getHttpServer())
      .get(`/report-images/${imageId}/content`)
      .expect(401);

    const contentRes = await agent
      .get(`/report-images/${imageId}/content`)
      .expect(200);
    expect(contentRes.headers['content-type']).toMatch(/image\//);
  });

  it('rejects invalid binary upload', async () => {
    const agent = await registerAgent(`invalid-${Date.now()}@example.invalid`);
    const invalid = createInvalidUploadBuffer();
    await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/report-images`)
      .attach('image', invalid, 'evil.bin')
      .expect(400);
  });

  it('forbids other users from reading image status/content', async () => {
    const owner = await registerAgent(`owner-${Date.now()}@example.invalid`);
    const other = await registerAgent(otherEmail);
    const png = await createTestBoardPng();

    const uploadRes = await owner
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/report-images`)
      .attach('image', png, 'board.png')
      .expect(201);

    const ownerUploadBody = uploadRes.body as { id: string };
    const imageId = ownerUploadBody.id;
    await other.get(`/report-images/${imageId}`).expect(403);
    await other.get(`/report-images/${imageId}/content`).expect(403);
  });

  it('supports multiple confirmed reports from one image', async () => {
    const agent = await registerAgent(`multi-${Date.now()}@example.invalid`);
    const png = await createTestBoardPng();

    const uploadRes = await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/report-images`)
      .attach('image', png, 'board.png')
      .expect(201);

    const uploadBody = uploadRes.body as { id: string };
    const imageId = uploadBody.id;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const statusRes = await agent
        .get(`/report-images/${imageId}`)
        .expect(200);
      const pollBody = statusRes.body as { status: string };
      if (pollBody.status === 'processed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: dieselFuelTypeId,
        price: '1.6790',
        currency: 'EUR',
        reportImageId: imageId,
        ocrAssisted: true,
      })
      .expect(201);

    await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: e10FuelTypeId,
        price: '1.7990',
        currency: 'EUR',
        reportImageId: imageId,
        ocrAssisted: true,
      })
      .expect(201);
  });
});
