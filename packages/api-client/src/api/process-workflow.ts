import type { OrderItemProcessDto } from '@algreen/shared-types';
import type {
  StartProcessWorkRequest,
  StopProcessWorkRequest,
  ResumeProcessWorkRequest,
  BlockProcessRequest,
  UnblockProcessRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const processWorkflowApi = {
  start(id: string, data: StartProcessWorkRequest) {
    return apiClient.post<OrderItemProcessDto>(`/order-item-processes/${id}/start`, data);
  },

  stop(id: string, data: StopProcessWorkRequest) {
    return apiClient.post(`/order-item-processes/${id}/stop`, data);
  },

  resume(id: string, data: ResumeProcessWorkRequest) {
    return apiClient.post(`/order-item-processes/${id}/resume`, data);
  },

  complete(id: string) {
    return apiClient.post(`/order-item-processes/${id}/complete`);
  },

  restart(id: string, data: { resetTime: boolean }) {
    return apiClient.post(`/order-item-processes/${id}/restart`, data);
  },

  block(id: string, data: BlockProcessRequest) {
    return apiClient.post(`/order-item-processes/${id}/block`, data);
  },

  unblock(id: string, data: UnblockProcessRequest) {
    return apiClient.post(`/order-item-processes/${id}/unblock`, data);
  },

  pauseOnLogout(data: { processId: string; userId: string }) {
    return apiClient.post('/order-item-processes/pause-on-logout', data);
  },

  resumeOnLogin(data: { processId: string; userId: string }) {
    return apiClient.post('/order-item-processes/resume-on-login', data);
  },

  /**
   * Toggle whether this process is excluded from /reports statistics + export.
   * Persisted server-side so the choice survives sessions and is visible
   * across users in the tenant (Sale/Bojan's "manuelno isključenje").
   */
  setExcludedFromReports(id: string, excluded: boolean) {
    return apiClient.patch(`/order-item-processes/${id}/excluded-from-reports`, { excluded });
  },
};
