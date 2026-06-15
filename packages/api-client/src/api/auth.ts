import type { LoginRequest, RefreshTokenRequest } from '@alblue/shared-types';
import type { LoginResponseDto } from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const authApi = {
  login(data: LoginRequest) {
    return apiClient.post<LoginResponseDto>('/auth/login', data);
  },

  refresh(data: RefreshTokenRequest) {
    return apiClient.post<LoginResponseDto>('/auth/refresh', data);
  },
};
