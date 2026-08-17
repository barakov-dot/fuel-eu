import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OcrSemaphoreService {
  private readonly maxConcurrency: number;
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly configService: ConfigService) {
    this.maxConcurrency = Number(
      this.configService.get<string>('OCR_MAX_CONCURRENCY') ?? '1',
    );
  }

  get max(): number {
    return this.maxConcurrency;
  }

  get activeCount(): number {
    return this.active;
  }

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
