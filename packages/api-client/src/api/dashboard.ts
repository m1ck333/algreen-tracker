import type {
  DashboardStatisticsDto,
  DeadlineWarningDto,
  LiveViewProcessDto,
  WorkerStatusDto,
  PendingBlockRequestDto,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const dashboardApi = {
  getWarnings() {
    return apiClient.get<DeadlineWarningDto[]>('/dashboard/warnings');
  },

  getLiveView() {
    return apiClient.get<LiveViewProcessDto[]>('/dashboard/live-view');
  },

  getWorkersStatus() {
    return apiClient.get<WorkerStatusDto[]>('/dashboard/workers-status');
  },

  getPendingBlocks() {
    return apiClient.get<PendingBlockRequestDto[]>('/dashboard/pending-blocks');
  },

  getStatistics() {
    return apiClient.get<DashboardStatisticsDto>('/dashboard/statistics');
  },
};
