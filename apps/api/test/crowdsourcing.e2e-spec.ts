import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEV_IDS, HELSINKI_CENTER } from '../src/database/seeds/dev-data';
import { ROUTING_PROVIDER_TOKEN } from '../src/modules/routing/routing.constants';
import { MockRoutingProvider } from '../src/modules/routing/providers/mock/mock-routing.provider';
import { GEOCODING_PROVIDER_TOKEN } from '../src/modules/geocoding/geocoding.constants';
import { MockGeocodingProvider } from '../src/modules/geocoding/providers/mock/mock-geocoding.provider';

describe('Crowdsourcing API (e2e)', () => {
  let app: INestApplication<App>;
  let dieselFuelTypeId: string;
  let e10FuelTypeId: string;
  const password = 'valid-passphrase-12';
  const userAEmail = `crowd-a-${Date.now()}@example.invalid`;
  const userBEmail = `crowd-b-${Date.now()}@example.invalid`;

  beforeAll(async () => {
    process.env.ROUTING_PROVIDER = 'mock';
    process.env.GEOCODING_PROVIDER = 'mock';
    process.env.WEB_ORIGIN = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ROUTING_PROVIDER_TOKEN)
      .useValue(new MockRoutingProvider())
      .overrideProvider(GEOCODING_PROVIDER_TOKEN)
      .useValue(new MockGeocodingProvider())
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
  });

  async function registerAgent(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ email, password, displayName: email })
      .expect(201);
    return agent;
  }

  it('rejects unauthenticated report submission', async () => {
    await request(app.getHttpServer())
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: dieselFuelTypeId,
        price: '1.7990',
        currency: 'EUR',
      })
      .expect(401);
  });

  it('Finland two-user flow: report diesel, nearby shows community price, confirm increases count', async () => {
    const agentA = await registerAgent(userAEmail);
    const agentB = await registerAgent(userBEmail);

    const reportRes = await agentA
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: dieselFuelTypeId,
        price: '1.7990',
        currency: 'EUR',
        location: HELSINKI_CENTER,
      })
      .expect(201);

    const report = reportRes.body as {
      id: string;
      price: string;
      status: string;
    };
    expect(report.price).toBe('1.7990');
    expect(['accepted', 'pending']).toContain(report.status);

    const nearbyRes = await request(app.getHttpServer())
      .get('/stations/nearby')
      .query({
        lat: HELSINKI_CENTER.lat,
        lon: HELSINKI_CENTER.lon,
        radiusKm: 5,
        fuelTypeId: dieselFuelTypeId,
        onlyWithPrice: true,
      })
      .expect(200);

    const nearbyBody = nearbyRes.body as {
      items: Array<{
        id: string;
        prices: Array<{ price: string; source: { type: string } }>;
      }>;
    };

    const noPriceStation = nearbyBody.items.find(
      (item) => item.id === DEV_IDS.stationHelsinkiNoPrice,
    );
    expect(noPriceStation).toBeDefined();
    expect(noPriceStation?.prices[0]?.price).toBe('1.7990');
    expect(noPriceStation?.prices[0]?.source.type).toBe('crowdsourced');

    await agentB
      .put(`/reports/${report.id}/vote`)
      .send({ vote: 'confirm' })
      .expect(200);

    const reportsList = await request(app.getHttpServer())
      .get(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .expect(200);

    const items = (
      reportsList.body as {
        items: Array<{ id: string; confirmations: number }>;
      }
    ).items;
    const votedReport = items.find((item) => item.id === report.id);
    expect(votedReport?.confirmations).toBeGreaterThanOrEqual(1);
  });

  it('forbids self-vote on own report', async () => {
    const agent = await registerAgent(
      `self-vote-${Date.now()}@example.invalid`,
    );

    const reportRes = await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNoPrice}/reports`)
      .send({
        fuelTypeId: e10FuelTypeId,
        price: '1.8990',
        currency: 'EUR',
      })
      .expect(201);

    const reportId = (reportRes.body as { id: string }).id;

    await agent
      .put(`/reports/${reportId}/vote`)
      .send({ vote: 'confirm' })
      .expect(403);
  });

  it('official price wins over conflicting community report on priced station', async () => {
    const agent = await registerAgent(`conflict-${Date.now()}@example.invalid`);

    await agent
      .post(`/stations/${DEV_IDS.stationHelsinkiNeste}/reports`)
      .send({
        fuelTypeId: e10FuelTypeId,
        price: '0.9990',
        currency: 'EUR',
      })
      .expect(201);

    const latestRes = await request(app.getHttpServer())
      .get(`/stations/${DEV_IDS.stationHelsinkiNeste}/prices/latest`)
      .expect(200);

    const latest = latestRes.body as Array<{
      fuelTypeId: string;
      price: string;
      source?: { type: string };
    }>;

    const e10 = latest.find((row) => row.fuelTypeId === e10FuelTypeId);
    expect(e10).toBeDefined();
    expect(Number(e10!.price)).toBeGreaterThan(1);
    expect(e10!.source?.type).not.toBe('crowdsourced');
  });
});
