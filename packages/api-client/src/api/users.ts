import type { UserDto, PagedResult, UserRoleChangeEntryDto, LoginAttemptDto } from '@alblue/shared-types';
import type { CreateUserRequest, UpdateUserRequest, ChangePasswordRequest } from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const usersApi = {
  getAll(params: { role?: string; isActive?: boolean; search?: string; page?: number; pageSize?: number; createdFrom?: string; createdTo?: string; sortBy?: string; sortDirection?: string }) {
    return apiClient.get<PagedResult<UserDto>>('/users', { params });
  },

  // SuperAdmin-only: every SuperAdmin across every tenant. BE returns a
  // plain list (not paged) — SA count is small (<20 expected).
  getSuperAdmins() {
    return apiClient.get<UserDto[]>('/users/super-admins');
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

  resetPassword(id: string, newPassword: string) {
    return apiClient.post(`/users/${id}/reset-password`, { newPassword });
  },

  delete(id: string) {
    return apiClient.delete(`/users/${id}`);
  },

  getRoleHistory(id: string) {
    return apiClient.get<UserRoleChangeEntryDto[]>(`/users/${id}/role-history`);
  },

  getLoginHistory(id: string, limit = 20) {
    return apiClient.get<LoginAttemptDto[]>(`/users/${id}/login-history`, { params: { limit } });
  },
};
