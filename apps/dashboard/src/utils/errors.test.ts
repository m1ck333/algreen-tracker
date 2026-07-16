import { describe, it, expect } from 'vitest';
import { getErrorMessage, getErrorCode, getTranslatedError } from './errors';

const envelope = (code?: string, message?: string) => ({
  response: { data: { error: { code, message } } },
});

describe('getErrorCode / getErrorMessage', () => {
  it('extracts the server-provided error code', () => {
    expect(getErrorCode(envelope('STOCK_INSUFFICIENT'))).toBe('STOCK_INSUFFICIENT');
  });

  it('returns undefined for a plain Error or missing envelope (network failure)', () => {
    expect(getErrorCode(new Error('boom'))).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
  });

  it('returns the server message, else the fallback', () => {
    expect(getErrorMessage(envelope(undefined, 'Server kaže ne'), 'fb')).toBe('Server kaže ne');
    expect(getErrorMessage(new Error('x'), 'fb')).toBe('fb');
    expect(getErrorMessage(undefined, 'fb')).toBe('fb');
  });
});

describe('getTranslatedError — 3-level fallback', () => {
  it('prefers a non-empty per-code translation', () => {
    const t = (key: string) =>
      key === 'common:errors.STOCK_INSUFFICIENT' ? 'Nema dovoljno na stanju' : '';
    expect(getTranslatedError(envelope('STOCK_INSUFFICIENT', 'srv'), t, 'fb')).toBe(
      'Nema dovoljno na stanju',
    );
  });

  it('falls through to the server message when the code has no translation (empty string)', () => {
    // The subtle branch: t() returns '' (defaultValue), which must NOT be shown.
    const t = () => '';
    expect(getTranslatedError(envelope('UNKNOWN_CODE', 'Server poruka'), t, 'fb')).toBe(
      'Server poruka',
    );
  });

  it('falls back to the hard fallback when there is neither translation nor server message', () => {
    const t = () => '';
    expect(getTranslatedError(new Error('net'), t, 'fb')).toBe('fb');
  });

  it('uses the server message when there is no code at all (t never consulted)', () => {
    const t = () => 'should-not-be-used';
    expect(getTranslatedError(envelope(undefined, 'Samo server'), t, 'fb')).toBe('Samo server');
  });
});
