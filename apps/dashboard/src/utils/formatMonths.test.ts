import { describe, it, expect } from 'vitest';
import { formatMonths, formatDays } from './formatMonths';

// Serbian plural rules are non-obvious (1/2-4/5+ with 11-14 teen exception).
// These tests pin down the table so a refactor can't quietly regress to
// "1 meseci" or "11 mesec".
describe('formatMonths', () => {
  describe('Serbian (default)', () => {
    it.each([
      [1, '1 mesec'],
      [2, '2 meseca'],
      [3, '3 meseca'],
      [4, '4 meseca'],
      [5, '5 meseci'],
      [11, '11 meseci'],
      [12, '12 meseci'],
      [13, '13 meseci'],
      [14, '14 meseci'],
      [21, '21 mesec'],
      [22, '22 meseca'],
      [25, '25 meseci'],
      [101, '101 mesec'],
      [111, '111 meseci'],
      [122, '122 meseca'],
    ])('formats %d as "%s"', (n, expected) => {
      expect(formatMonths(n)).toBe(expected);
    });

    it('rounds fractional months', () => {
      expect(formatMonths(1.4)).toBe('1 mesec');
      expect(formatMonths(1.5)).toBe('2 meseca');
    });

    it('treats negative numbers by absolute value', () => {
      expect(formatMonths(-1)).toBe('1 mesec');
      expect(formatMonths(-5)).toBe('5 meseci');
    });
  });

  describe('English', () => {
    it('uses singular for 1, plural otherwise', () => {
      expect(formatMonths(1, 'en')).toBe('1 month');
      expect(formatMonths(0, 'en')).toBe('0 months');
      expect(formatMonths(2, 'en')).toBe('2 months');
      expect(formatMonths(11, 'en')).toBe('11 months');
    });
  });
});

describe('formatDays', () => {
  describe('Serbian (default)', () => {
    it.each([
      [1, '1 dan'],
      [2, '2 dana'],
      [5, '5 dana'],
      [11, '11 dana'],
      [21, '21 dan'],
      [22, '22 dana'],
      [101, '101 dan'],
      [111, '111 dana'],
    ])('formats %d as "%s"', (n, expected) => {
      expect(formatDays(n)).toBe(expected);
    });
  });

  describe('English', () => {
    it.each([
      [1, '1 day'],
      [0, '0 days'],
      [2, '2 days'],
    ])('formats %d as "%s"', (n, expected) => {
      expect(formatDays(n, 'en')).toBe(expected);
    });
  });
});
