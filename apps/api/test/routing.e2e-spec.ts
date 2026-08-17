import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEV_IDS, HELSINKI_CENTER } from '../src/database/seeds/dev-data';
import { ROUTING_PROVIDER_TOKEN } from '../src/modules/routing/routing.constants';
import { MockRoutingProvider } from '../src/modules/routing/providers/mock/mock-routing.provider';

describe('Routing API (e2e)', () => {
  let app: INestApplication<App>;
  let e10FuelTypeId: string;

  const helsinkiWest = {
    lat: 60.176,
    lon: 24.809,
  };

  beforeAll(async () => {
    process.env.ROUTING_PROVIDER = 'mock';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ROUTING_PROVIDER_TOKEN)
      .useValue(new MockRoutingProvider())
      .compile();

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

  it('POST /routes returns normalized route geometry', () => {
    return request(app.getHttpServer())
      .post('/routes')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          distanceMeters: number;
          durationSeconds: number;
          geometry: { type: string; coordinates: [number, number][] };
        };
        expect(body.distanceMeters).toBeGreaterThan(0);
        expect(body.durationSeconds).toBeGreaterThan(0);
        expect(body.geometry.type).toBe('LineString');
        expect(body.geometry.coordinates[0]).toEqual([
          HELSINKI_CENTER.lon,
          HELSINKI_CENTER.lat,
        ]);
      });
  });

  it('POST /routes rejects invalid coordinates', async () => {
    await request(app.getHttpServer())
      .post('/routes')
      .send({
        origin: { lat: 999, lon: 24.9384 },
        destination: helsinkiWest,
      })
      .expect(400);
  });

  it('POST /routes/stations finds corridor candidates and exact detours', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'EUR',
        corridorKm: 5,
        limit: 10,
        refuelLiters: '45',
        vehicleConsumptionLPer100Km: '7.0',
        sort: 'effective_saving',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          route: { distanceMeters: number };
          referencePrice: string;
          referencePriceSource: string;
          items: Array<{
            station: { id: string };
            route: {
              distanceToRouteMeters: number;
              detourMeters: number;
              routeProgress: number;
            };
            savings: { effectiveSaving: string };
          }>;
          meta: {
            corridorCandidateCount: number;
            exactRoutedCandidateCount: number;
            currencyFilteringApplied: boolean;
          };
        };

        expect(body.route.distanceMeters).toBeGreaterThan(0);
        expect(body.referencePrice).toBeDefined();
        expect(body.referencePriceSource).toBe('route_median');
        expect(body.meta.corridorCandidateCount).toBeGreaterThan(0);
        expect(body.meta.exactRoutedCandidateCount).toBeGreaterThan(0);
        expect(body.meta.currencyFilteringApplied).toBe(true);
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items.every((item) => item.route.detourMeters >= 0)).toBe(
          true,
        );
        expect(
          body.items.some(
            (item) => item.station.id === DEV_IDS.stationHelsinkiBudget,
          ),
        ).toBe(true);
        expect(body.items.every((item) => item.route.routeProgress >= 0)).toBe(
          true,
        );
      });
  });

  it('POST /routes/stations excludes out-of-corridor stations', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'EUR',
        corridorKm: 2,
        limit: 20,
        refuelLiters: '45',
        vehicleConsumptionLPer100Km: '7.0',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as { items: Array<{ station: { id: string } }> };
        expect(
          body.items.some(
            (item) => item.station.id === DEV_IDS.stationPorvooOutOfRange,
          ),
        ).toBe(false);
      });
  });

  it('POST /routes/stations supports price sorting', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'EUR',
        refuelLiters: '45',
        vehicleConsumptionLPer100Km: '7.0',
        sort: 'price',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ fuel: { price: string } }>;
        };
        const prices = body.items.map((item) => Number(item.fuel.price));
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
        }
      });
  });

  it('POST /routes/stations can include negative effective savings', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'EUR',
        refuelLiters: '10',
        vehicleConsumptionLPer100Km: '20',
        referencePrice: '1.5000',
        sort: 'effective_saving',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ savings: { effectiveSaving: string } }>;
        };
        expect(body.items.length).toBeGreaterThan(0);
      });
  });

  it('POST /routes/stations rejects mixed-currency requests without valid currency filter', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'SEK',
        refuelLiters: '45',
        vehicleConsumptionLPer100Km: '7.0',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as {
          items: Array<{ fuel: { currency: string } }>;
          meta: { currencyFilteringApplied: boolean };
        };
        expect(body.items.every((item) => item.fuel.currency === 'SEK')).toBe(
          true,
        );
        expect(body.meta.currencyFilteringApplied).toBe(true);
      });
  });

  it('POST /routes/stations rejects invalid refuel liters', () => {
    return request(app.getHttpServer())
      .post('/routes/stations')
      .send({
        origin: HELSINKI_CENTER,
        destination: helsinkiWest,
        fuelTypeId: e10FuelTypeId,
        currency: 'EUR',
        refuelLiters: '0',
        vehicleConsumptionLPer100Km: '7.0',
      })
      .expect(400);
  });
});
