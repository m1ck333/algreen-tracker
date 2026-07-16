import { describe, it, expect } from 'vitest';
import { toExcelArgb, valueToString, escapeCsv } from './exportTable';

describe('escapeCsv', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsv('abc')).toBe('abc');
    expect(escapeCsv('')).toBe('');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsv('a"b')).toBe('"a""b"');
  });

  it('quotes values containing commas or newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('a\nb')).toBe('"a\nb"');
    expect(escapeCsv('a\rb')).toBe('"a\rb"');
  });
});

describe('toExcelArgb', () => {
  it('prefixes a 6-digit hex with full opacity and upper-cases it', () => {
    expect(toExcelArgb('92D050')).toBe('FF92D050');
    expect(toExcelArgb('ff0000')).toBe('FFFF0000');
  });

  it('strips a leading # before converting', () => {
    expect(toExcelArgb('#92D050')).toBe('FF92D050');
  });

  it('passes an 8-digit ARGB hex through (upper-cased)', () => {
    expect(toExcelArgb('80ff0000')).toBe('80FF0000');
  });

  it('returns undefined for empty, missing or wrong-length input', () => {
    expect(toExcelArgb(undefined)).toBeUndefined();
    expect(toExcelArgb('')).toBeUndefined();
    expect(toExcelArgb('FFF')).toBeUndefined();
    expect(toExcelArgb('1234567')).toBeUndefined();
  });
});

describe('valueToString', () => {
  it('renders null and undefined as empty strings', () => {
    expect(valueToString(null)).toBe('');
    expect(valueToString(undefined)).toBe('');
  });

  it('renders a Date as its ISO string', () => {
    const d = new Date('2026-07-03T10:20:30.000Z');
    expect(valueToString(d)).toBe('2026-07-03T10:20:30.000Z');
  });

  it('renders booleans as TRUE / FALSE', () => {
    expect(valueToString(true)).toBe('TRUE');
    expect(valueToString(false)).toBe('FALSE');
  });

  it('stringifies numbers and strings', () => {
    expect(valueToString(42)).toBe('42');
    expect(valueToString('hi')).toBe('hi');
  });
});
