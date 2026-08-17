import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ROUTING_PROVIDER_TOKEN } from '../src/modules/routing/routing.constants';
import { MockRoutingProvider } from '../src/modules/routing/providers/mock/mock-routing.provider';
import { GEOCODING_PROVIDER_TOKEN } from '../src/modules/geocoding/geocoding.constants';
import { MockGeocodingProvider } from '../src/modules/geocoding/providers/mock/mock-geocoding.provider';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  const testPassword = 'valid-passphrase-12';
  const testEmail = `auth-test-${Date.now()}@example.invalid`;

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
    app.enableCors({
      origin: ['http://localhost:3000'],
      credentials: true,
    });
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

  it('registers, persists session, and returns /auth/me', async () => {
    const agent = request.agent(app.getHttpServer());

    const registerRes = await agent
      .post('/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: 'Auth Test User',
      })
      .expect(201);

    const body = registerRes.body as {
      user: { email: string; displayName: string | null };
    };
    expect(body.user.email).toBe(testEmail);
    expect(body.user.displayName).toBe('Auth Test User');

    const meRes = await agent.get('/auth/me').expect(200);
    expect((meRes.body as { user: { email: string } }).user.email).toBe(
      testEmail,
    );
  });

  it('rejects duplicate registration safely', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword })
      .expect(409);
  });

  it('rejects invalid credentials generically', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.invalid', password: testPassword })
      .expect(401)
      .expect((res) => {
        const body = res.body as { message?: string };
        expect(body.message).toBe('Invalid email or password');
      });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrong-password-xyz' })
      .expect(401)
      .expect((res) => {
        const body = res.body as { message?: string };
        expect(body.message).toBe('Invalid email or password');
      });
  });

  it('logs in with normalized email and logs out', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({ email: `  ${testEmail.toUpperCase()}  `, password: testPassword })
      .expect(201);

    await agent.get('/auth/me').expect(200);

    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
  });

  it('rejects unauthenticated preferences access', async () => {
    await request(app.getHttpServer()).get('/me/preferences').expect(401);
  });
});
