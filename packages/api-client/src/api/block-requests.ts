import type { BlockRequestDto, RequestStatus } from '@algreen/shared-types';
import type {
  CreateBlockRequestRequest,
  HandleBlockRequestRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const blockRequestsApi = {
  getAll(tenantId: string, status?: RequestStatus) {
    return apiClient.get<BlockRequestDto[]>('/block-requests', { params: { tenantId, status } });
  },

  create(data: CreateBlockRequestRequest) {
    return apiClient.post<BlockRequestDto>('/block-requests', data);
  },

  approve(id: string, data: HandleBlockRequestRequest) {
    return apiClient.post<BlockRequestDto>(`/block-requests/${id}/approve`, data);
  },

  reject(id: string, data: HandleBlockRequestRequest) {
    return apiClient.post<BlockRequestDto>(`/block-requests/${id}/reject`, data);
  },
};
