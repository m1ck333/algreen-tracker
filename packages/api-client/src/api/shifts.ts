import type { ShiftDto } from '@algreen/shared-types';
import type { CreateShiftRequest, UpdateShiftRequest } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const shiftsApi = {
  getAll(tenantId: string) {
    return apiClient.get<ShiftDto[]>('/shifts', { params: { tenantId } });
  },

  create(data: CreateShiftRequest) {
    return apiClient.post<ShiftDto>('/shifts', data);
  },

  update(id: string, data: UpdateShiftRequest) {
    return apiClient.put<ShiftDto>(`/shifts/${id}`, data);
  },
};
