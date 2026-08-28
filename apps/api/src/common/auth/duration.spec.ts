import { parseDurationSeconds } from './duration';

describe('parseDurationSeconds', () => {
  it('converts each unit to seconds', () => {
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('15m')).toBe(900);
    expect(parseDurationSeconds('2h')).toBe(7200);
    expect(parseDurationSeconds('7d')).toBe(604800);
  });

  it('rejects a malformed duration', () => {
    expect(() => parseDurationSeconds('15 minutes')).toThrow(/Invalid duration/);
    expect(() => parseDurationSeconds('m15')).toThrow();
    expect(() => parseDurationSeconds('')).toThrow();
  });
});
