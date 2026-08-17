import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PRIMARY_DEV_STATION_ID } from '../src/database/seeds/dev-data';

describe('Domain API (e2e)', () => {
  let app: INestApplication<App>;

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

  it('GET /countries returns EU countries', () => {
    return request(app.getHttpServer())
      .get('/countries')
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ iso2: string; isEuMember: boolean }>;
        expect(body.length).toBe(27);
        expect(body.every((c) => c.isEuMember)).toBe(true);
        expect(body.some((c) => c.iso2 === 'FI')).toBe(true);
      });
  });

  it('GET /fuel-types returns canonical fuel types', () => {
    return request(app.getHttpServer())
      .get('/fuel-types')
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ code: string }>;
        expect(body.length).toBeGreaterThanOrEqual(10);
        expect(body.some((f) => f.code === 'e10')).toBe(true);
        expect(body.some((f) => f.code === 'diesel')).toBe(true);
      });
  });

  it('GET /stations/:id returns fixture station', () => {
    return request(app.getHttpServer())
      .get(`/stations/${PRIMARY_DEV_STATION_ID}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          id: string;
          city: string;
          latitude: number;
          longitude: number;
        };
        expect(body.id).toBe(PRIMARY_DEV_STATION_ID);
        expect(body.city).toBe('Helsinki');
        expect(typeof body.latitude).toBe('number');
        expect(typeof body.longitude).toBe('number');
      });
  });

  it('GET /stations/:id returns 404 for unknown station', () => {
    return request(app.getHttpServer())
      .get('/stations/00000000-0000-4000-8000-000000000099')
      .expect(404);
  });

  it('GET /stations/:id returns 400 for malformed id', () => {
    return request(app.getHttpServer()).get('/stations/not-a-uuid').expect(400);
  });

  it('GET /stations/:id/prices/latest returns newest per fuel', () => {
    return request(app.getHttpServer())
      .get(`/stations/${PRIMARY_DEV_STATION_ID}/prices/latest`)
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{
          fuelCode: string;
          price: string;
          observedAt: string;
        }>;
        expect(body.length).toBeGreaterThanOrEqual(2);
        const e10 = body.find((p) => p.fuelCode === 'e10');
        expect(e10?.price).toBe('1.9490');
      });
  });

  it('GET /stations/:id/prices/history returns chronological observations', async () => {
    const fuelsRes = await request(app.getHttpServer()).get('/fuel-types');
    const fuels = fuelsRes.body as Array<{ id: string; code: string }>;
    const e10 = fuels.find((f) => f.code === 'e10');
    expect(e10).toBeDefined();

    return request(app.getHttpServer())
      .get(
        `/stations/${PRIMARY_DEV_STATION_ID}/prices/history?fuelTypeId=${e10!.id}`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ price: string; observedAt: string }>;
        expect(body.length).toBe(5);
        expect(body[0]?.price).toBe('1.8990');
        expect(body[4]?.price).toBe('1.9490');
        const dates = body.map((b) => new Date(b.observedAt).getTime());
        expect(dates[0]).toBeLessThanOrEqual(dates[1]);
        expect(dates[1]).toBeLessThanOrEqual(dates[2]);
      });
  });

  it('GET /stations/:id/prices/history enforces limit maximum', async () => {
    const fuelsRes = await request(app.getHttpServer()).get('/fuel-types');
    const fuels = fuelsRes.body as Array<{ id: string; code: string }>;
    const e10 = fuels.find((f) => f.code === 'e10');

    return request(app.getHttpServer())
      .get(
        `/stations/${PRIMARY_DEV_STATION_ID}/prices/history?fuelTypeId=${e10!.id}&limit=5000`,
      )
      .expect(400);
  });

  it('GET /stations/:id/prices/history requires fuelTypeId', () => {
    return request(app.getHttpServer())
      .get(`/stations/${PRIMARY_DEV_STATION_ID}/prices/history`)
      .expect(400);
  });
});
