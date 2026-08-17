import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  const globalPrefix = configService.get<string>('API_GLOBAL_PREFIX', '');
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix.replace(/^\//, ''));
  }

  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy === 'true' || (trustProxy !== 'false' && isProduction)) {
    app.set('trust proxy', 1);
  }

  if (!isProduction) {
    const webOrigin =
      configService.get<string>('WEB_ORIGIN') ??
      configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';
    app.enableCors({
      origin: webOrigin.split(',').map((value) => value.trim()),
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
