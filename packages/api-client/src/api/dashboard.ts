import type {
  DashboardStatisticsDto,
  DeadlineWarningDto,
  LiveViewProcessDto,
  WorkerStatusDto,
  PendingBlockRequestDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const dashboardApi = {
  getWarnings(tenantId: string) {
    return apiClient.get<DeadlineWarningDto[]>('/dashboard/warnings', { params: { tenantId } });
  },

  getLiveView(tenantId: string) {
    return apiClient.get<LiveViewProcessDto[]>('/dashboard/live-view', { params: { tenantId } });
  },

  getWorkersStatus(tenantId: string) {
    return apiClient.get<WorkerStatusDto[]>('/dashboard/workers-status', { params: { tenantId } });
  },

  getPendingBlocks(tenantId: string) {
    return apiClient.get<PendingBlockRequestDto[]>('/dashboard/pending-blocks', { params: { tenantId } });
  },

  getStatistics(tenantId: string) {
    return apiClient.get<DashboardStatisticsDto>('/dashboard/statistics', { params: { tenantId } });
  },
};
