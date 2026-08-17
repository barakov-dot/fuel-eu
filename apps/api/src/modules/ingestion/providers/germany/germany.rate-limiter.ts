import { GERMANY_MIN_REQUEST_INTERVAL_MS } from './germany.constants';

export class GermanyRateLimiter {
  private lastRequestAt = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = GERMANY_MIN_REQUEST_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs;
  }

  async waitForSlot(): Promise<number> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    const waitMs =
      this.lastRequestAt === 0 ? 0 : Math.max(0, this.minIntervalMs - elapsed);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    this.lastRequestAt = Date.now();
    return waitMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
