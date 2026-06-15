import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Sentry from '@sentry/react';
import type { UserDto } from '@alblue/shared-types';
import { authApi, tokenManager } from '@alblue/api-client';
import { parseJwt } from './jwt-utils';

export interface AuthState {
  user: UserDto | null;
  tenantId: string | null;
  /** SuperAdmin is logged into a tenant that isn't their home — UI is
   *  rendered read-only and a banner is shown. Derived from the JWT
   *  claim cross_tenant_session. */
  isCrossTenantSession: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, tenantCode: string) => Promise<void>;
  logout: () => void;
  setUser: (user: UserDto) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenantId: null,
      isCrossTenantSession: false,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password, tenantCode) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login({ email, password, tenantCode });
          tokenManager.setTokens(data.token, data.refreshToken);
          const payload = parseJwt(data.token);
          const user = data.user;
          const resolvedTenantId = payload?.tenant_id ?? user.tenantId;
          const crossTenant = payload?.cross_tenant_session === 'true';
          set({
            user,
            tenantId: resolvedTenantId,
            isCrossTenantSession: crossTenant,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          Sentry.setUser({ id: user.id });
          if (resolvedTenantId) {
            Sentry.setTag('tenant_id', resolvedTenantId);
          }
        } catch (err: unknown) {
          // BE returns a coded error in the standard envelope. The rate
          // limiter is the one path that comes back as a plain 429 without
          // the envelope — surface it as RATE_LIMITED so the FE can show
          // a meaningful "too many attempts" message.
          const errLike = err as { response?: { status?: number; data?: { error?: { code?: string } } } };
          const status = errLike?.response?.status;
          const code = errLike?.response?.data?.error?.code;
          const resolved = status === 429 ? 'RATE_LIMITED' : (code || 'LOGIN_FAILED');
          set({ isLoading: false, error: resolved });
          throw err;
        }
      },

      logout: () => {
        tokenManager.clear();
        set({
          user: null,
          tenantId: null,
          isCrossTenantSession: false,
          isAuthenticated: false,
          error: null,
        });
        Sentry.setUser(null);
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'alblue-auth',
      partialize: (state) => ({
        user: state.user,
        tenantId: state.tenantId,
        isCrossTenantSession: state.isCrossTenantSession,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
