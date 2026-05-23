import type {
  ProcessTimeItemDto,
  TimeTrackingResponseDto,
  WorkerHoursDto,
  DeliveryComplianceReportDto,
  ReportGranularity,
  ProcessTimeTrendDto,
  ActiveProcessFunnelDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export interface ProcessTimesQuery {
  from?: string;
  to?: string;
  productCategoryIds?: string[];
  orderTypes?: string[];
}

export interface TimeTrackingQuery {
  from?: string;
  to?: string;
  processId?: string;
  complexity?: string;
  orderNumber?: string;
  productCategoryIds?: string[];
  orderTypes?: string[];
}

export interface WorkerHoursQuery {
  from: string;
  to: string;
  userId?: string;
}

export interface DeliveryComplianceQuery {
  from?: string;
  to?: string;
  granularity: ReportGranularity;
  orderTypes?: string[];
}

export interface ProcessTimeTrendQuery {
  processId: string;
  complexity: string;
  granularity: ReportGranularity;
  from?: string;
  to?: string;
}

export interface ActiveProcessFunnelQuery {
  orderTypes?: string[];
  complexity?: string;
}

// Axios serializes array params as `?key[]=` by default; ASP.NET Core expects
// repeated keys (`?key=a&key=b`). This helper forces the repeat-key form.
const repeatArraySerializer = {
  paramsSerializer: {
    indexes: null,
  },
};

export const reportsApi = {
  getProcessTimes(params?: ProcessTimesQuery) {
    return apiClient.get<{ processes: ProcessTimeItemDto[] }>('/reports/process-times', {
      params,
      ...repeatArraySerializer,
    });
  },

  getTimeTracking(params: TimeTrackingQuery) {
    return apiClient.get<TimeTrackingResponseDto>('/reports/time-tracking', {
      params,
      ...repeatArraySerializer,
    });
  },

  getWorkerHours(params: WorkerHoursQuery) {
    return apiClient.get<{ workers: WorkerHoursDto[] }>('/reports/worker-hours', { params });
  },

  getDeliveryCompliance(params: DeliveryComplianceQuery) {
    return apiClient.get<DeliveryComplianceReportDto>('/reports/delivery-compliance', {
      params,
      ...repeatArraySerializer,
    });
  },

  getProcessTimeTrend(params: ProcessTimeTrendQuery) {
    return apiClient.get<ProcessTimeTrendDto>('/reports/process-time-trend', { params });
  },

  getActiveProcessFunnel(params: ActiveProcessFunnelQuery) {
    return apiClient.get<ActiveProcessFunnelDto>('/reports/active-process-funnel', {
      params,
      ...repeatArraySerializer,
    });
  },
};
