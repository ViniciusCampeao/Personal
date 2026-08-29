import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelativeDay,
  formatSkinfold,
  formatWeight,
  isoDayInSaoPaulo,
} from './format';

describe('date formatting', () => {
  it('renders a UTC timestamp in the São Paulo calendar day', () => {
    // 02:00 UTC is still the previous evening in São Paulo (UTC-3) — the whole reason
    // the time zone is passed explicitly instead of relying on the device.
    expect(formatDate('2026-08-29T02:00:00Z')).toBe('28/08/2026');
    expect(isoDayInSaoPaulo('2026-08-29T02:00:00Z')).toBe('2026-08-28');
  });

  it('keeps a midday timestamp on its own day', () => {
    expect(formatDate('2026-08-29T12:00:00Z')).toBe('29/08/2026');
  });

  it('renders date and time together', () => {
    expect(formatDateTime('2026-08-29T12:30:00Z')).toContain('29/08/2026');
    expect(formatDateTime('2026-08-29T12:30:00Z')).toContain('09:30');
  });

  it('describes recent days in words', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    expect(formatRelativeDay(now)).toBe('hoje');
    expect(formatRelativeDay(yesterday)).toBe('ontem');
  });
});

describe('unit formatting', () => {
  it('uses a comma as the decimal separator', () => {
    expect(formatWeight(82.5)).toBe('82,5 kg');
    expect(formatSkinfold(12.4)).toBe('12,4 mm');
    expect(formatPercent(14.25)).toBe('14,3%');
  });

  it('drops a trailing zero decimal', () => {
    expect(formatWeight(80)).toBe('80 kg');
  });
});

describe('formatDuration', () => {
  it('renders minutes and seconds below an hour', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('adds hours once it passes one', () => {
    expect(formatDuration(3920)).toBe('1:05:20');
  });

  it('never renders a negative duration', () => {
    expect(formatDuration(-10)).toBe('0:00');
  });
});
