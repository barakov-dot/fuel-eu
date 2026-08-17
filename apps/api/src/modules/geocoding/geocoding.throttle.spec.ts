import { GeocodingRequestThrottle } from './geocoding.throttle';

describe('GeocodingRequestThrottle', () => {
  it('waits until minimum interval elapsed', async () => {
    const now = jest
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(200);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const throttle = new GeocodingRequestThrottle(1000, now, sleep);

    await throttle.waitForSlot();
    await throttle.waitForSlot();

    expect(sleep).toHaveBeenCalledWith(800);
  });

  it('does not sleep when enough time has passed', async () => {
    const now = jest
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2000);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const throttle = new GeocodingRequestThrottle(1000, now, sleep);

    await throttle.waitForSlot();
    await throttle.waitForSlot();

    expect(sleep).not.toHaveBeenCalled();
  });
});
