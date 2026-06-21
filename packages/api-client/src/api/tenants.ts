import type { AllTenantPaymentDto, TenantDto, TenantPaymentDto, TenantSettingsDto, PagedResult } from '@alblue/shared-types';
import type {
  BlockTenantRequest,
  CreateTenantPaymentRequest,
  CreateTenantRequest,
  UpdateTenantFeaturesRequest,
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

  // Naplata (billing) — SuperAdmin-only. Payment ledger + manual block.
  listPayments(tenantId: string) {
    return apiClient.get<TenantPaymentDto[]>(`/tenants/${tenantId}/payments`);
  },

  // Read-only view of the CURRENT tenant's payment history — tenant
  // Admin can confirm their company's recorded payments without seeing
  // the SuperAdmin cross-tenant data.
  listMyPayments() {
    return apiClient.get<TenantPaymentDto[]>('/tenants/me/payments');
  },

  addPayment(tenantId: string, data: CreateTenantPaymentRequest) {
    return apiClient.post<TenantPaymentDto>(`/tenants/${tenantId}/payments`, data);
  },

  updatePayment(tenantId: string, paymentId: string, data: CreateTenantPaymentRequest) {
    return apiClient.put<TenantPaymentDto>(`/tenants/${tenantId}/payments/${paymentId}`, data);
  },

  deletePayment(tenantId: string, paymentId: string) {
    return apiClient.delete<void>(`/tenants/${tenantId}/payments/${paymentId}`);
  },

  block(tenantId: string, data: BlockTenantRequest) {
    return apiClient.post<TenantDto>(`/tenants/${tenantId}/block`, data);
  },

  unblock(tenantId: string) {
    return apiClient.post<TenantDto>(`/tenants/${tenantId}/unblock`, {});
  },

  // SA-only "Sve uplate" cross-tenant payments view.
  listAllPayments(params?: { tenantId?: string; paidFrom?: string; paidTo?: string; currency?: string; page?: number; pageSize?: number; sortBy?: string; sortDirection?: string }) {
    return apiClient.get<PagedResult<AllTenantPaymentDto>>('/tenants/payments', { params });
  },

  // SA-only feature toggles per tenant. Body lists the DISABLED feature
  // keys — empty array enables everything.
  updateFeatures(tenantId: string, data: UpdateTenantFeaturesRequest) {
    return apiClient.put<TenantDto>(`/tenants/${tenantId}/features`, data);
  },
};
