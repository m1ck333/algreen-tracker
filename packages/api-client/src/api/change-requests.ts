import type { ChangeRequestDto, PagedResult, RequestStatus } from '@algreen/shared-types';
import type {
  CreateChangeRequestRequest,
  HandleChangeRequestRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const changeRequestsApi = {
  getAll(tenantId: string, status?: RequestStatus) {
    return apiClient.get<PagedResult<ChangeRequestDto>>('/change-requests', {
      params: { tenantId, status },
    });
  },

  getMy(tenantId: string, userId: string) {
    return apiClient.get<PagedResult<ChangeRequestDto>>('/change-requests/my', {
      params: { tenantId, userId },
    });
  },

  create(data: CreateChangeRequestRequest) {
    return apiClient.post<ChangeRequestDto>('/change-requests', data);
  },

  approve(id: string, data: HandleChangeRequestRequest) {
    return apiClient.post<ChangeRequestDto>(`/change-requests/${id}/approve`, data);
  },

  reject(id: string, data: HandleChangeRequestRequest) {
    return apiClient.post<ChangeRequestDto>(`/change-requests/${id}/reject`, data);
  },
};
