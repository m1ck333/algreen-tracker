import { apiClient } from '../axios-instance';

export const dashboardApi = {
  getWarnings(tenantId: string) {
    return apiClient.get('/dashboard/warnings', { params: { tenantId } });
  },

  getLiveView(tenantId: string) {
    return apiClient.get('/dashboard/live-view', { params: { tenantId } });
  },

  getWorkersStatus(tenantId: string) {
    return apiClient.get('/dashboard/workers-status', { params: { tenantId } });
  },

  getPendingBlocks(tenantId: string) {
    return apiClient.get('/dashboard/pending-blocks', { params: { tenantId } });
  },

  getStatistics(tenantId: string) {
    return apiClient.get('/dashboard/statistics', { params: { tenantId } });
  },
};
