import postgres from 'postgres';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

export class AdvisoryLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisoryLockError';
  }
}

/** Stable 32-bit key derived from provider code for pg advisory locks. */
export function providerLockKey(providerCode: string): number {
  let hash = 0;
  for (let i = 0; i < providerCode.length; i++) {
    hash = (hash * 31 + providerCode.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

@Injectable()
export class IngestionLockService {
  constructor(private readonly configService: ConfigService) {}

  async withProviderLock<T>(
    lockKey: number,
    providerCode: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const connectionString =
      this.configService.getOrThrow<string>('DATABASE_URL');
    const lockClient = postgres(connectionString, { max: 1 });

    try {
      const [row] = await lockClient<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey}) AS acquired
      `;

      if (!row?.acquired) {
        throw new AdvisoryLockError(
          `Another ${providerCode} ingestion is already running`,
        );
      }

      return await fn();
    } finally {
      await lockClient`SELECT pg_advisory_unlock(${lockKey})`;
      await lockClient.end({ timeout: 5 });
    }
  }
}
