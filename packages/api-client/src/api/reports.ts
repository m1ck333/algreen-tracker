import type {
  ProcessAverageDto,
  TimeTrackingResponseDto,
  WorkerHoursDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export interface TimeTrackingQuery {
  tenantId: string;
  from: string;
  to: string;
  processId?: string;
  complexity?: string;
}

export interface WorkerHoursQuery {
  tenantId: string;
  from: string;
  to: string;
  userId?: string;
}

export const reportsApi = {
  getProcessAverages(tenantId: string) {
    return apiClient.get<{ processes: ProcessAverageDto[] }>('/reports/process-averages', {
      params: { tenantId },
    });
  },

  getTimeTracking(params: TimeTrackingQuery) {
    return apiClient.get<TimeTrackingResponseDto>('/reports/time-tracking', { params });
  },

  getWorkerHours(params: WorkerHoursQuery) {
    return apiClient.get<{ workers: WorkerHoursDto[] }>('/reports/worker-hours', { params });
  },
};
