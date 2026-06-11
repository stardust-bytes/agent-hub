import { DenialTracker } from './denial-tracking';

describe('DenialTracker', () => {
  let tracker: DenialTracker;

  beforeEach(() => {
    tracker = new DenialTracker();
  });

  it('should start at zero', () => {
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(0);
  });

  it('should increment on recordDenial', () => {
    tracker.recordDenial();
    expect(tracker.consecutiveDenials).toBe(1);
    expect(tracker.totalDenials).toBe(1);
  });

  it('should reset consecutive on recordAllow', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.recordAllow();
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(2);
  });

  it('should exceed limit after 3 consecutive denials', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    const exceeded = tracker.recordDenial();
    expect(exceeded).toBe(true);
    expect(tracker.isLimitExceeded()).toBe(true);
  });

  it('should not exceed limit after 2 consecutive denials', () => {
    tracker.recordDenial();
    const exceeded = tracker.recordDenial();
    expect(exceeded).toBe(false);
    expect(tracker.isLimitExceeded()).toBe(false);
  });

  it('should reset on reset()', () => {
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.recordDenial();
    tracker.reset();
    expect(tracker.consecutiveDenials).toBe(0);
    expect(tracker.totalDenials).toBe(0);
  });
});
