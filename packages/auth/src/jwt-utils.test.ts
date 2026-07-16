import { describe, it, expect } from 'vitest';
import { parseJwt, isTokenExpired } from './jwt-utils';

// Hand-build a JWT of the form header.<base64url(payload)>.sig — signature is
// never verified client-side, so any string works there.
function base64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.sig`;
}

describe('parseJwt', () => {
  it('parses the claims of a well-formed token', () => {
    const token = makeToken({
      sub: 'u1',
      email: 'a@b.rs',
      tenant_id: 'T-1',
      role: 'Admin',
      exp: 9999999999,
    });
    const payload = parseJwt(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('u1');
    expect(payload?.tenant_id).toBe('T-1');
    expect(payload?.role).toBe('Admin');
  });

  it('decodes base64url tokens that contain - and _ characters', () => {
    // ">" and "?" push the base64 alphabet into + and / which the encoder
    // rewrites to - and _; parseJwt must reverse that before atob.
    const token = makeToken({ sub: '>>>', email: 'a?b?c', exp: 9999999999 });
    expect(token).toMatch(/[-_]/); // sanity: the payload actually uses url-safe chars
    const payload = parseJwt(token);
    expect(payload?.sub).toBe('>>>');
    expect(payload?.email).toBe('a?b?c');
  });

  it('returns null for garbage / malformed input (fail-safe)', () => {
    expect(parseJwt('garbage')).toBeNull();
    expect(parseJwt('')).toBeNull();
    expect(parseJwt('a.!!!not-base64!!!.c')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('is false for a token whose exp is comfortably in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeToken({ exp }))).toBe(false);
  });

  it('treats a token expiring inside the 30s buffer as already expired', () => {
    // exp is 10s in the future, but the 30s safety buffer marks it expired now.
    const exp = Math.floor(Date.now() / 1000) + 10;
    expect(isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('is true for a token already past its exp', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    expect(isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('is true (fail-safe) for a malformed token', () => {
    expect(isTokenExpired('garbage')).toBe(true);
    expect(isTokenExpired('')).toBe(true);
  });
});
