import type {
  ProcessAverageDto,
  TimeTrackingResponseDto,
  WorkerHoursDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export interface TimeTrackingQuery {
  from: string;
  to: string;
  processId?: string;
  complexity?: string;
}

export interface WorkerHoursQuery {
  from: string;
  to: string;
  userId?: string;
}

export const reportsApi = {
  getProcessAverages() {
    return apiClient.get<{ processes: ProcessAverageDto[] }>('/reports/process-averages');
  },

  getTimeTracking(params: TimeTrackingQuery) {
    return apiClient.get<TimeTrackingResponseDto>('/reports/time-tracking', { params });
  },

  getWorkerHours(params: WorkerHoursQuery) {
    return apiClient.get<{ workers: WorkerHoursDto[] }>('/reports/worker-hours', { params });
  },
};
