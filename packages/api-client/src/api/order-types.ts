import type {
  OrderTypeDto,
  DeleteOrderTypeResult,
  PagedResult,
  CreateOrderTypeRequest,
  UpdateOrderTypeRequest,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const orderTypesApi = {
  getAll(params: {
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortDirection?: string;
  }) {
    return apiClient.get<PagedResult<OrderTypeDto>>('/order-types', { params });
  },

  create(data: CreateOrderTypeRequest) {
    return apiClient.post<OrderTypeDto>('/order-types', data);
  },

  update(id: string, data: UpdateOrderTypeRequest) {
    return apiClient.put<OrderTypeDto>(`/order-types/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<DeleteOrderTypeResult>(`/order-types/${id}`);
  },
};
