import type { LoginRequest, RefreshTokenRequest } from '@algreen/shared-types';
import type { LoginResponseDto } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const authApi = {
  login(data: LoginRequest) {
    return apiClient.post<LoginResponseDto>('/auth/login', data);
  },

  refresh(data: RefreshTokenRequest) {
    return apiClient.post<LoginResponseDto>('/auth/refresh', data);
  },
};
