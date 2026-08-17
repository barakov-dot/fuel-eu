import type { INestApplicationContext } from '@nestjs/common';
import { PostgresConnection } from '../database/postgres.connection';
import { TesseractOcrProvider } from '../modules/ocr/providers/tesseract/tesseract.provider';
import { RedisConnection } from '../redis/redis.connection';

export async function shutdownApplicationContext(
  app: INestApplicationContext,
): Promise<void> {
  try {
    const postgresConnection = app.get(PostgresConnection, { strict: false });
    if (postgresConnection) {
      await postgresConnection.onModuleDestroy();
    }
  } catch {
    // Postgres optional for some CLI paths
  }

  try {
    const redisConnection = app.get(RedisConnection, { strict: false });
    if (redisConnection) {
      await redisConnection.onModuleDestroy();
    }
  } catch {
    // Redis optional for some CLI paths
  }

  try {
    const tesseract = app.get(TesseractOcrProvider, { strict: false });
    if (tesseract) {
      await tesseract.onModuleDestroy();
    }
  } catch {
    // OCR worker not loaded in ingestion CLI
  }

  await app.close();
}
