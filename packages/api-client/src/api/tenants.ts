import type { TenantDto, TenantSettingsDto } from '@algreen/shared-types';
import type {
  CreateTenantRequest,
  UpdateTenantRequest,
  UpdateTenantSettingsRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const tenantsApi = {
  getAll() {
    return apiClient.get<TenantDto[]>('/tenants');
  },

  getById(id: string) {
    return apiClient.get<TenantDto>(`/tenants/${id}`);
  },

  create(data: CreateTenantRequest) {
    return apiClient.post<TenantDto>('/tenants', data);
  },

  update(id: string, data: UpdateTenantRequest) {
    return apiClient.put<TenantDto>(`/tenants/${id}`, data);
  },

  getSettings(id: string) {
    return apiClient.get<TenantSettingsDto>(`/tenants/${id}/settings`);
  },

  updateSettings(id: string, data: UpdateTenantSettingsRequest) {
    return apiClient.put<TenantSettingsDto>(`/tenants/${id}/settings`, data);
  },
};
