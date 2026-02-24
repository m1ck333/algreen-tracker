import axios from 'axios';
import { tokenManager } from './token-manager';

export const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5030/api',
  headers: { 'Content-Type': 'application/json' },
});

let _onForceLogout: (() => void) | null = null;

export function setOnForceLogout(callback: () => void) {
  _onForceLogout = callback;
}

function forceLogout() {
  tokenManager.clear();
  if (_onForceLogout) {
    _onForceLogout();
  }
  window.location.href = '/login';
}

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - attempt token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh on the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh')) {
      forceLogout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    try {
      const { data } = await apiClient.post('/auth/refresh', { refreshToken });
      tokenManager.setTokens(data.token, data.refreshToken);
      processQueue(null, data.token);
      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
