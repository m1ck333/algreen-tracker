import type { ProcessDto, PagedResult } from '@algreen/shared-types';
import type {
  CreateProcessRequest,
  UpdateProcessRequest,
  AddSubProcessRequest,
  UpdateSubProcessRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const processesApi = {
  getAll(tenantId: string) {
    return apiClient.get<PagedResult<ProcessDto>>('/processes', { params: { tenantId } });
  },

  getById(id: string) {
    return apiClient.get<ProcessDto>(`/processes/${id}`);
  },

  create(data: CreateProcessRequest) {
    return apiClient.post<ProcessDto>('/processes', data);
  },

  update(id: string, data: UpdateProcessRequest) {
    return apiClient.put<ProcessDto>(`/processes/${id}`, data);
  },

  deactivate(id: string) {
    return apiClient.delete(`/processes/${id}`);
  },

  addSubProcess(processId: string, data: AddSubProcessRequest) {
    return apiClient.post<ProcessDto>(`/processes/${processId}/sub-processes`, data);
  },

  updateSubProcess(processId: string, subProcessId: string, data: UpdateSubProcessRequest) {
    return apiClient.put<ProcessDto>(
      `/processes/${processId}/sub-processes/${subProcessId}`,
      data,
    );
  },

  deactivateSubProcess(processId: string, subProcessId: string) {
    return apiClient.delete(`/processes/${processId}/sub-processes/${subProcessId}`);
  },
};
