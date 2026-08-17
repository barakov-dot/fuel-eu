import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  DEV_IDS,
  HELSINKI_CENTER,
  PRIMARY_DEV_STATION_ID,
} from '../src/database/seeds/dev-data';

describe('Geospatial API (e2e)', () => {
  let app: INestApplication<App>;
  let e10FuelTypeId: string;

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

    const fuelsRes = await request(app.getHttpServer()).get('/fuel-types');
    const fuels = fuelsRes.body as Array<{ id: string; code: string }>;
    e10FuelTypeId = fuels.find((f) => f.code === 'e10')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /stations/nearby returns stations within default radius', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ id: string; distanceMeters: number }>;
          meta: { radiusKm: number; count: number };
        };
        expect(body.meta.radiusKm).toBe(10);
        expect(body.items.length).toBeGreaterThanOrEqual(5);
        expect(
          body.items.some((item) => item.id === PRIMARY_DEV_STATION_ID),
        ).toBe(true);
        expect(body.items.every((item) => item.distanceMeters <= 10_000)).toBe(
          true,
        );
      });
  });

  it('GET /stations/nearby sorts by distance ascending', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&sort=distance`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ distanceMeters: number }>;
        };
        const distances = body.items.map((item) => item.distanceMeters);
        for (let i = 1; i < distances.length; i++) {
          expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
        }
      });
  });

  it('GET /stations/nearby excludes stations outside radius', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&radiusKm=5`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as { items: Array<{ id: string }> };
        expect(
          body.items.some(
            (item) => item.id === DEV_IDS.stationPorvooOutOfRange,
          ),
        ).toBe(false);
      });
  });

  it('GET /stations/nearby respects limit', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&limit=2`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as { items: unknown[]; meta: { count: number } };
        expect(body.items.length).toBe(2);
        expect(body.meta.count).toBe(2);
      });
  });

  it('GET /stations/nearby rejects invalid lat', () => {
    return request(app.getHttpServer())
      .get(`/stations/nearby?lat=999&lon=${HELSINKI_CENTER.lon}`)
      .expect(400);
  });

  it('GET /stations/nearby rejects invalid lon', () => {
    return request(app.getHttpServer())
      .get(`/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=999`)
      .expect(400);
  });

  it('GET /stations/nearby rejects invalid radius', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&radiusKm=200`,
      )
      .expect(400);
  });

  it('GET /stations/nearby rejects invalid limit', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&limit=500`,
      )
      .expect(400);
  });

  it('GET /stations/nearby filters by fuelTypeId', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&fuelTypeId=${e10FuelTypeId}`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{
            id: string;
            prices: Array<{ fuelType: { id: string } }>;
          }>;
        };
        expect(body.items.length).toBeGreaterThan(0);
        expect(
          body.items.every((item) =>
            item.prices.some((price) => price.fuelType.id === e10FuelTypeId),
          ),
        ).toBe(true);
        expect(
          body.items.some((item) => item.id === DEV_IDS.stationHelsinkiNoPrice),
        ).toBe(false);
      });
  });

  it('GET /stations/nearby onlyWithPrice excludes stations without prices', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&onlyWithPrice=true`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ id: string; prices: unknown[] }>;
        };
        expect(body.items.every((item) => item.prices.length > 0)).toBe(true);
      });
  });

  it('GET /stations/nearby requires fuelTypeId for sort=price', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&sort=price`,
      )
      .expect(400);
  });

  it('GET /stations/nearby sort=price returns cheapest E10 first in EUR', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&fuelTypeId=${e10FuelTypeId}&sort=price&currency=EUR&radiusKm=20`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{
            id: string;
            prices: Array<{ price: string; currency: string }>;
          }>;
        };
        const e10Prices = body.items.map(
          (item) =>
            item.prices.find((price) => price.currency === 'EUR')!.price,
        );
        expect(e10Prices[0]).toBe('1.8790');
        expect(body.items[0]?.id).toBe(DEV_IDS.stationHelsinkiBudget);
      });
  });

  it('GET /stations/nearby sort=price rejects mixed currencies without currency filter', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&fuelTypeId=${e10FuelTypeId}&sort=price&radiusKm=20`,
      )
      .expect(400);
  });

  it('GET /stations/nearby maxPrice requires fuelTypeId and currency', async () => {
    await request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&maxPrice=2.00`,
      )
      .expect(400);

    await request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&fuelTypeId=${e10FuelTypeId}&maxPrice=2.00`,
      )
      .expect(400);
  });

  it('GET /stations/nearby maxPrice filters correctly', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&fuelTypeId=${e10FuelTypeId}&maxPrice=1.90&currency=EUR&radiusKm=20`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{
            prices: Array<{ price: string; currency: string }>;
          }>;
        };
        for (const item of body.items) {
          const e10 = item.prices.find((price) => price.currency === 'EUR');
          expect(Number(e10?.price)).toBeLessThanOrEqual(1.9);
        }
      });
  });

  it('GET /stations/nearby returns metric distance within tolerance', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&limit=1`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ id: string; distanceMeters: number }>;
        };
        const closest = body.items[0];
        expect(closest?.id).toBe(DEV_IDS.stationHelsinkiBudget);
        expect(closest?.distanceMeters).toBeGreaterThan(50);
        expect(closest?.distanceMeters).toBeLessThan(500);
      });
  });

  it('GET /stations/nearby latest observation uses deterministic tie-break', () => {
    return request(app.getHttpServer())
      .get(`/stations/${PRIMARY_DEV_STATION_ID}/prices/latest`)
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ fuelCode: string; price: string }>;
        const e10 = body.find((price) => price.fuelCode === 'e10');
        expect(e10?.price).toBe('1.9490');
      });
  });

  it('GET /stations/bbox returns stations inside viewport', () => {
    return request(app.getHttpServer())
      .get('/stations/bbox?west=24.8&south=60.1&east=25.1&north=60.3')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ id: string; lat: number; lon: number }>;
          meta: { count: number; truncated: boolean };
        };
        expect(body.items.length).toBeGreaterThan(0);
        expect(
          body.items.some((item) => item.id === PRIMARY_DEV_STATION_ID),
        ).toBe(true);
        expect(
          body.items.some(
            (item) => item.id === DEV_IDS.stationPorvooOutOfRange,
          ),
        ).toBe(false);
      });
  });

  it('GET /stations/bbox rejects invalid bbox', async () => {
    await request(app.getHttpServer())
      .get('/stations/bbox?west=24.8&south=60.3&east=25.1&north=60.1')
      .expect(400);

    await request(app.getHttpServer())
      .get('/stations/bbox?west=170&south=60.1&east=-170&north=60.3')
      .expect(400);
  });

  it('GET /stations/bbox respects limit and truncated flag', () => {
    return request(app.getHttpServer())
      .get('/stations/bbox?west=24.8&south=60.1&east=25.1&north=60.3&limit=2')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: unknown[];
          meta: { count: number; limit: number; truncated: boolean };
        };
        expect(body.items.length).toBe(2);
        expect(body.meta.limit).toBe(2);
        expect(body.meta.truncated).toBe(true);
      });
  });

  it('GET /stations/nearby price entries include ageSeconds', () => {
    return request(app.getHttpServer())
      .get(
        `/stations/nearby?lat=${HELSINKI_CENTER.lat}&lon=${HELSINKI_CENTER.lon}&limit=1&onlyWithPrice=true`,
      )
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{
            prices: Array<{ ageSeconds: number; observedAt: string }>;
          }>;
        };
        const price = body.items[0]?.prices[0];
        expect(typeof price?.ageSeconds).toBe('number');
        expect(price.ageSeconds).toBeGreaterThanOrEqual(0);
        expect(price?.observedAt).toBeDefined();
      });
  });
});
