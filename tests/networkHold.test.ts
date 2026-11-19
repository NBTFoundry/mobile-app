import { BACKGROUND_RELEASE_MS, IDLE_RELEASE_MS, releaseDelay } from '../src/car/networkHold';

describe('releaseDelay', () => {
  it('keeps the car network for the idle delay in the foreground', () => {
    expect(releaseDelay(0, 1_000_000)).toBe(IDLE_RELEASE_MS);
  });

  it('keeps it two minutes after going to the background', () => {
    expect(BACKGROUND_RELEASE_MS).toBe(2 * 60_000);
    expect(releaseDelay(1_000_000, 1_000_000)).toBe(BACKGROUND_RELEASE_MS);
    expect(releaseDelay(1_000_000, 1_000_000 + 90_000)).toBe(30_000);
  });

  it('lets go at once once the two minutes have passed', () => {
    expect(releaseDelay(1_000_000, 1_000_000 + BACKGROUND_RELEASE_MS)).toBe(0);
    expect(releaseDelay(1_000_000, 1_000_000 + 10 * 60_000)).toBe(0);
  });
});
