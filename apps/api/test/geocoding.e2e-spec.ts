import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GEOCODING_PROVIDER_TOKEN } from '../src/modules/geocoding/geocoding.constants';
import { MockGeocodingProvider } from '../src/modules/geocoding/providers/mock/mock-geocoding.provider';

describe('Geocoding API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.GEOCODING_PROVIDER = 'mock';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GEOCODING_PROVIDER_TOKEN)
      .useValue(new MockGeocodingProvider())
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /geocoding/search returns normalized items', () => {
    return request(app.getHttpServer())
      .get('/geocoding/search')
      .query({ q: 'Paris', limit: 5, language: 'en' })
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          items: Array<{
            id: string;
            name: string;
            displayName: string;
            location: { lat: number; lon: number };
          }>;
        };
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items[0].name).toBe('Paris');
        expect(body.items[0].location.lat).toBeCloseTo(48.8566, 3);
      });
  });

  it('GET /geocoding/search rejects short query', async () => {
    await request(app.getHttpServer())
      .get('/geocoding/search')
      .query({ q: 'P' })
      .expect(400);
  });

  it('GET /geocoding/search rejects invalid country codes', async () => {
    await request(app.getHttpServer())
      .get('/geocoding/search')
      .query({ q: 'Paris', countryCodes: 'France' })
      .expect(400);
  });

  it('GET /geocoding/reverse returns normalized result', () => {
    return request(app.getHttpServer())
      .get('/geocoding/reverse')
      .query({ lat: 48.8566, lon: 2.3522, language: 'en' })
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          displayName: string;
          location: { lat: number; lon: number };
        };
        expect(body.displayName).toContain('Paris');
        expect(body.location.lat).toBeCloseTo(48.8566, 3);
      });
  });

  it('GET /geocoding/reverse rejects invalid coordinates', async () => {
    await request(app.getHttpServer())
      .get('/geocoding/reverse')
      .query({ lat: 999, lon: 2.3522 })
      .expect(400);
  });

  it('GET /geocoding/reverse returns 404 when no result', async () => {
    await request(app.getHttpServer())
      .get('/geocoding/reverse')
      .query({ lat: 0, lon: 0 })
      .expect(404);
  });
});
