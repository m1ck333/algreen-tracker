import type { UserDto } from '@algreen/shared-types';
import type { CreateUserRequest, UpdateUserRequest, ChangePasswordRequest } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const usersApi = {
  getAll(tenantId: string) {
    return apiClient.get<UserDto[]>('/users', { params: { tenantId } });
  },

  getById(id: string) {
    return apiClient.get<UserDto>(`/users/${id}`);
  },

  create(data: CreateUserRequest) {
    return apiClient.post<UserDto>('/users', data);
  },

  update(id: string, data: UpdateUserRequest) {
    return apiClient.put<UserDto>(`/users/${id}`, data);
  },

  changePassword(id: string, data: ChangePasswordRequest) {
    return apiClient.post(`/users/${id}/change-password`, data);
  },
};
