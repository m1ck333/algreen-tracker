import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserDto } from '@alblue/shared-types';
import { UserRole } from '@alblue/shared-types';

// ── Mocks ────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  setTokens: vi.fn(),
  clear: vi.fn(),
  sentrySetUser: vi.fn(),
  sentrySetTag: vi.fn(),
}));

vi.mock('@alblue/api-client', () => ({
  authApi: { login: mocks.login },
  tokenManager: { setTokens: mocks.setTokens, clear: mocks.clear },
}));

vi.mock('@sentry/react', () => ({
  setUser: mocks.sentrySetUser,
  setTag: mocks.sentrySetTag,
}));

import { useAuthStore } from './auth-store';

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

const user: UserDto = {
  id: 'u1',
  tenantId: 'T-USER',
  email: 'a@b.rs',
  firstName: 'A',
  lastName: 'B',
  fullName: 'A B',
  role: UserRole.Admin,
  additionalRoles: [],
  processes: [],
  canIncludeWithdrawnInAnalysis: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null,
    tenantId: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});

describe('auth-store login', () => {
  it('stores tokens, resolves tenantId from the JWT claim, and tags Sentry', async () => {
    const token = makeToken({ tenant_id: 'T-JWT', exp: 9999999999 });
    mocks.login.mockResolvedValue({ data: { token, refreshToken: 'r1', user } });

    await useAuthStore.getState().login('a@b.rs', 'pw', 'TEN');

    const state = useAuthStore.getState();
    expect(mocks.setTokens).toHaveBeenCalledWith(token, 'r1');
    expect(state.user).toEqual(user);
    expect(state.tenantId).toBe('T-JWT');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(mocks.sentrySetUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(mocks.sentrySetTag).toHaveBeenCalledWith('tenant_id', 'T-JWT');
  });

  it('falls back to user.tenantId when the JWT has no tenant_id claim', async () => {
    const token = makeToken({ exp: 9999999999 }); // no tenant_id
    mocks.login.mockResolvedValue({ data: { token, refreshToken: 'r1', user } });

    await useAuthStore.getState().login('a@b.rs', 'pw', 'TEN');

    expect(useAuthStore.getState().tenantId).toBe('T-USER');
    expect(mocks.sentrySetTag).toHaveBeenCalledWith('tenant_id', 'T-USER');
  });

  it('maps a bare 429 to RATE_LIMITED', async () => {
    mocks.login.mockRejectedValue({ response: { status: 429 } });

    await expect(useAuthStore.getState().login('a@b.rs', 'pw', 'TEN')).rejects.toBeTruthy();

    const state = useAuthStore.getState();
    expect(state.error).toBe('RATE_LIMITED');
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('surfaces the coded error from the envelope', async () => {
    mocks.login.mockRejectedValue({
      response: { status: 401, data: { error: { code: 'INVALID_CREDENTIALS' } } },
    });

    await expect(useAuthStore.getState().login('a@b.rs', 'pw', 'TEN')).rejects.toBeTruthy();
    expect(useAuthStore.getState().error).toBe('INVALID_CREDENTIALS');
  });

  it('falls back to LOGIN_FAILED when there is no error envelope', async () => {
    mocks.login.mockRejectedValue(new Error('network down'));

    await expect(useAuthStore.getState().login('a@b.rs', 'pw', 'TEN')).rejects.toBeTruthy();
    expect(useAuthStore.getState().error).toBe('LOGIN_FAILED');
  });
});

describe('auth-store logout', () => {
  it('clears tokens, resets Sentry user, and wipes state', () => {
    useAuthStore.setState({
      user,
      tenantId: 'T-USER',
      isAuthenticated: true,
      error: 'SOMETHING',
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.sentrySetUser).toHaveBeenCalledWith(null);
    expect(state.user).toBeNull();
    expect(state.tenantId).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });
});
