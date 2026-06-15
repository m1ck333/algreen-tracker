import type { SpecialRequestTypeDto, PagedResult } from '@alblue/shared-types';
import type {
  CreateSpecialRequestTypeRequest,
  UpdateSpecialRequestTypeRequest,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const specialRequestTypesApi = {
  getAll(params: { isActive?: boolean; search?: string; page?: number; pageSize?: number; createdFrom?: string; createdTo?: string; sortBy?: string; sortDirection?: string }) {
    return apiClient.get<PagedResult<SpecialRequestTypeDto>>('/special-request-types', { params });
  },

  create(data: CreateSpecialRequestTypeRequest) {
    return apiClient.post<SpecialRequestTypeDto>('/special-request-types', data);
  },

  update(id: string, data: UpdateSpecialRequestTypeRequest) {
    return apiClient.put<SpecialRequestTypeDto>(`/special-request-types/${id}`, data);
  },

  deactivate(id: string) {
    return apiClient.delete(`/special-request-types/${id}`);
  },

  activate(id: string) {
    return apiClient.post(`/special-request-types/${id}/activate`);
  },
};
