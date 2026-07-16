import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AxiosAdapter,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// Stateful token-manager mock: setTokens updates what getToken returns, so a
// replayed request (which re-runs the request interceptor) picks up the new
// token exactly like the real thing.
const tm = vi.hoisted(() => ({
  state: { token: 'old-token' as string | null, refresh: 'old-refresh' as string | null },
  clear: vi.fn(),
}));

vi.mock('./token-manager', () => ({
  tokenManager: {
    getToken: () => tm.state.token,
    getRefreshToken: () => tm.state.refresh,
    setToken: (t: string) => {
      tm.state.token = t;
    },
    setRefreshToken: (r: string) => {
      tm.state.refresh = r;
    },
    setTokens: (t: string, r: string) => {
      tm.state.token = t;
      tm.state.refresh = r;
    },
    clear: () => {
      tm.clear();
      tm.state.token = null;
      tm.state.refresh = null;
    },
  },
}));

import { apiClient, setOnForceLogout } from './axios-instance';

// ── Adapter helpers ──────────────────────────────────────
const ok = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown) =>
  Object.assign(new Error(`Request failed ${status}`), {
    isAxiosError: true,
    config,
    response: { status, data, statusText: '', headers: {}, config },
  });

const authOf = (config: InternalAxiosRequestConfig): string | undefined => {
  const h = config.headers as unknown as { Authorization?: string };
  return h?.Authorization;
};

beforeEach(() => {
  tm.state.token = 'old-token';
  tm.state.refresh = 'old-refresh';
  tm.clear.mockClear();
  setOnForceLogout(() => {});
  // Stub navigation target so forceLogout's redirect is observable and jsdom
  // doesn't emit "Not implemented: navigation".
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { href: '' },
  });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('401 refresh-retry interceptor', () => {
  it('coalesces two concurrent 401s into a single /auth/refresh and replays both', async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls++;
        return ok(config, { token: 'new-token', refreshToken: 'new-refresh' });
      }
      // Old token → 401; after refresh the replay carries the new token → 200.
      if (authOf(config) === 'Bearer new-token') return ok(config, { ok: true });
      throw fail(config, 401, {});
    }) as AxiosAdapter;

    const [a, b] = await Promise.all([apiClient.get('/data-a'), apiClient.get('/data-b')]);

    expect(refreshCalls).toBe(1);
    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
    expect(tm.state.token).toBe('new-token');
  });

  it('rejects the queue, clears tokens and redirects when refresh fails', async () => {
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) throw fail(config, 401, {});
      throw fail(config, 401, {});
    }) as AxiosAdapter;

    const results = await Promise.allSettled([apiClient.get('/data-a'), apiClient.get('/data-b')]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(tm.clear).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('force-logs-out on TENANT_BLOCKED without attempting a refresh', async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls++;
        return ok(config, { token: 'new-token', refreshToken: 'new-refresh' });
      }
      throw fail(config, 401, { error: { code: 'TENANT_BLOCKED' } });
    }) as AxiosAdapter;

    await expect(apiClient.get('/data')).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
    expect(tm.clear).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('offline guard: does NOT clear tokens or redirect when navigator is offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401, { error: { code: 'TENANT_BLOCKED' } });
    }) as AxiosAdapter;

    await expect(apiClient.get('/data')).rejects.toBeTruthy();
    expect(tm.clear).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
    // Token survives the offline flap so the session can recover on reconnect.
    expect(tm.state.token).toBe('old-token');
  });

  it('_retry guard: a 401 on an already-retried request rejects without refreshing', async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls++;
        return ok(config, { token: 'new-token', refreshToken: 'new-refresh' });
      }
      throw fail(config, 401, {});
    }) as AxiosAdapter;

    await expect(
      apiClient.get('/data', { _retry: true } as unknown as AxiosRequestConfig),
    ).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
  });

  it('force-logs-out when the /auth/refresh call itself returns 401', async () => {
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw fail(config, 401, {});
    }) as AxiosAdapter;

    await expect(apiClient.post('/auth/refresh', { refreshToken: 'r' })).rejects.toBeTruthy();
    expect(tm.clear).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });
});
