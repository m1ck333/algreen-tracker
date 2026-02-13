import type { WorkSessionDto } from '@algreen/shared-types';
import type { CheckInRequest, CheckOutRequest } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const workSessionsApi = {
  getAll(tenantId: string, date: string) {
    return apiClient.get<WorkSessionDto[]>('/work-sessions', { params: { tenantId, date } });
  },

  checkIn(data: CheckInRequest) {
    return apiClient.post<WorkSessionDto>('/work-sessions/check-in', data);
  },

  checkOut(data: CheckOutRequest) {
    return apiClient.post<WorkSessionDto>('/work-sessions/check-out', data);
  },
};
