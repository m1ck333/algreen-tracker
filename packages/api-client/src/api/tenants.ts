import type { TenantDto, TenantSettingsDto, PagedResult } from '@alblue/shared-types';
import type {
  CreateTenantRequest,
  UpdateTenantRequest,
  UpdateTenantSettingsRequest,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const tenantsApi = {
  getAll(params?: { isActive?: boolean; search?: string; page?: number; pageSize?: number; createdFrom?: string; createdTo?: string; sortBy?: string; sortDirection?: string }) {
    return apiClient.get<PagedResult<TenantDto>>('/tenants', { params });
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

  // "me" endpoints — let the tenant's own Admin manage their settings
  // without going through the SuperAdmin-gated id routes. Tenant is
  // resolved from the JWT on the BE.
  getMy() {
    return apiClient.get<TenantDto>('/tenants/me');
  },

  getMySettings() {
    return apiClient.get<TenantSettingsDto>('/tenants/me/settings');
  },

  updateMySettings(data: UpdateTenantSettingsRequest) {
    return apiClient.put<TenantSettingsDto>('/tenants/me/settings', data);
  },

  // Logo: tenant Admin uploads via multipart, BE streams the file back on GET,
  // DELETE removes both the file and the LogoUrl field. The GET endpoint
  // requires auth, so the sidebar/<img> uses a blob URL after fetching.
  uploadMyLogo(file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<TenantDto>('/tenants/me/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteMyLogo() {
    return apiClient.delete<TenantDto>('/tenants/me/logo');
  },

  getMyLogoBlob() {
    return apiClient.get<Blob>('/tenants/me/logo', { responseType: 'blob' });
  },
};
