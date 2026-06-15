import { apiClient } from '../axios-instance';
import type { MaterialDto, PagedResult } from '@alblue/shared-types';

export interface CreateMaterialRequest {
  code: string;
  name: string;
  unit: string;
  category: string;
  minQuantity: number;
  maxQuantity: number;
  dimensionX: number | null;
  dimensionY: number | null;
  dimensionZ: number | null;
  location: string | null;
  notes: string | null;
}

export type UpdateMaterialRequest = Omit<CreateMaterialRequest, 'code'>;

export interface GetMaterialsParams {
  isActive?: boolean;
  category?: string;
  search?: string;
  sortBy?: string;
  isDescending?: boolean;
  page?: number;
  pageSize?: number;
}

export const materialsApi = {
  getAll(params: GetMaterialsParams = {}) {
    return apiClient.get<PagedResult<MaterialDto>>('/materials', { params });
  },
  getById(id: string) {
    return apiClient.get<MaterialDto>(`/materials/${id}`);
  },
  create(data: CreateMaterialRequest) {
    return apiClient.post<MaterialDto>('/materials', data);
  },
  update(id: string, data: UpdateMaterialRequest) {
    return apiClient.put<MaterialDto>(`/materials/${id}`, data);
  },
  activate(id: string) {
    return apiClient.post(`/materials/${id}/activate`);
  },
  deactivate(id: string) {
    return apiClient.post(`/materials/${id}/deactivate`);
  },
  import(data: ImportMaterialsRequest) {
    return apiClient.post<ImportMaterialsResult>('/materials/import', data);
  },
};

export interface ImportMaterialsRequest {
  items: ImportMaterialItem[];
}

export interface ImportMaterialItem {
  code: string;
  name: string;
  unit: string;
  category: string;
  minQuantity: number;
  maxQuantity: number;
  dimensionX: number | null;
  dimensionY: number | null;
  dimensionZ: number | null;
  location: string | null;
  notes: string | null;
}

export interface ImportMaterialsResult {
  created: number;
  errors: Array<{ rowIndex: number; code: string; reason: string }>;
}
