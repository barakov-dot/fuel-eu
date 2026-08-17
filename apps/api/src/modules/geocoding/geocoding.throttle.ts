export type TimeSource = () => number;

export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Ensures a minimum interval between outgoing provider requests (Nominatim policy). */
export class GeocodingRequestThrottle {
  private lastRequestAt: number | null = null;

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: TimeSource = Date.now,
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  async waitForSlot(): Promise<void> {
    const current = this.now();
    if (this.lastRequestAt !== null) {
      const elapsed = current - this.lastRequestAt;
      if (elapsed < this.minIntervalMs) {
        await this.sleep(this.minIntervalMs - elapsed);
      }
    }
    this.lastRequestAt = this.now();
  }

  reset(): void {
    this.lastRequestAt = null;
  }
}
