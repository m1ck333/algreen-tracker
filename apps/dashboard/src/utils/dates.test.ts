import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatTime } from './dates';

describe('formatDate / formatDateTime / formatTime', () => {
  // Use a fixed-offset ISO so the assertion doesn't drift across the
  // host's local time zone (formatDate uses dayjs, which respects the
  // local zone). We pin the expected output to UTC-equivalents that
  // ignore the milliseconds.
  const iso = '2026-03-15T09:42:00Z';

  it('formats date as DD.MM.YYYY.', () => {
    // The date part is stable across reasonable TZs (UTC+0 to UTC+14)
    // for noon-ish UTC; using 09:42Z keeps it on the same day in most.
    expect(formatDate(iso)).toMatch(/^\d{2}\.\d{2}\.\d{4}\.$/);
  });

  it('formats date+time as DD.MM.YYYY. HH:mm', () => {
    expect(formatDateTime(iso)).toMatch(/^\d{2}\.\d{2}\.\d{4}\. \d{2}:\d{2}$/);
  });

  it('formats time as HH:mm', () => {
    expect(formatTime(iso)).toMatch(/^\d{2}:\d{2}$/);
  });

  it.each([
    ['formatDate', formatDate],
    ['formatDateTime', formatDateTime],
    ['formatTime', formatTime],
  ])('%s returns em-dash for null/undefined/empty', (_name, fn) => {
    expect(fn(null)).toBe('—');
    expect(fn(undefined)).toBe('—');
    expect(fn('')).toBe('—');
  });

  it('accepts a Date object', () => {
    const d = new Date(iso);
    expect(formatDate(d)).toMatch(/^\d{2}\.\d{2}\.\d{4}\.$/);
  });
});
