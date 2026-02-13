import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserDto } from '@algreen/shared-types';
import { authApi, tokenManager } from '@algreen/api-client';
import { parseJwt } from './jwt-utils';

export interface AuthState {
  user: UserDto | null;
  tenantId: string | null;
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
          set({
            user,
            tenantId: payload?.tenant_id ?? user.tenantId,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Login failed';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: () => {
        tokenManager.clear();
        set({
          user: null,
          tenantId: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'algreen-auth',
      partialize: (state) => ({
        user: state.user,
        tenantId: state.tenantId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
