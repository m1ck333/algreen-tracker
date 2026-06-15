import type { BlockRequestDto, PagedResult, RequestStatus } from '@alblue/shared-types';
import type {
  CreateBlockRequestRequest,
  HandleBlockRequestRequest,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const blockRequestsApi = {
  getAll(params: { status?: RequestStatus; orderId?: string; search?: string; page?: number; pageSize?: number; createdFrom?: string; createdTo?: string; sortBy?: string; sortDirection?: string }) {
    return apiClient.get<PagedResult<BlockRequestDto>>('/block-requests', { params });
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
