import type { OrderDto, OrderDetailDto, PagedResult } from '@algreen/shared-types';
import type { OrderStatus, OrderType } from '@algreen/shared-types';
import type {
  CreateOrderRequest,
  UpdateOrderRequest,
  AddOrderItemRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export interface OrdersQuery {
  tenantId: string;
  status?: OrderStatus;
  orderType?: OrderType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const ordersApi = {
  getAll(params: OrdersQuery) {
    return apiClient.get<PagedResult<OrderDto>>('/orders', { params });
  },

  getById(id: string) {
    return apiClient.get<OrderDetailDto>(`/orders/${id}`);
  },

  create(data: CreateOrderRequest) {
    return apiClient.post<OrderDetailDto>('/orders', data);
  },

  update(id: string, data: UpdateOrderRequest) {
    return apiClient.put<OrderDetailDto>(`/orders/${id}`, data);
  },

  activate(id: string) {
    return apiClient.post(`/orders/${id}/activate`);
  },

  pause(id: string) {
    return apiClient.post(`/orders/${id}/pause`);
  },

  resume(id: string) {
    return apiClient.post(`/orders/${id}/resume`);
  },

  cancel(id: string) {
    return apiClient.post(`/orders/${id}/cancel`);
  },

  changePriority(id: string, priority: number) {
    return apiClient.post(`/orders/${id}/change-priority`, { priority });
  },

  addItem(orderId: string, data: AddOrderItemRequest) {
    return apiClient.post<OrderDetailDto>(`/orders/${orderId}/items`, data);
  },

  removeItem(orderId: string, itemId: string) {
    return apiClient.delete(`/orders/${orderId}/items/${itemId}`);
  },
};
