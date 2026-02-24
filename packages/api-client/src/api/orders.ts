import type { OrderDto, OrderDetailDto, OrderMasterViewDto, PagedResult } from '@algreen/shared-types';
import type { OrderStatus, OrderType } from '@algreen/shared-types';
import type {
  CreateOrderRequest,
  UpdateOrderRequest,
  AddOrderItemRequest,
  WithdrawOrderToProcessRequest,
  AddSpecialRequestRequest,
  OverrideComplexityRequest,
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

  getMasterView(params: OrdersQuery) {
    return apiClient.get<PagedResult<OrderMasterViewDto>>('/orders/master-view', { params });
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
    return apiClient.put(`/orders/${id}/priority`, { priority });
  },

  addItem(orderId: string, data: AddOrderItemRequest) {
    return apiClient.post<OrderDetailDto>(`/orders/${orderId}/items`, data);
  },

  removeItem(orderId: string, itemId: string) {
    return apiClient.delete(`/orders/${orderId}/items/${itemId}`);
  },

  withdraw(id: string, data: WithdrawOrderToProcessRequest) {
    return apiClient.post(`/orders/${id}/withdraw`, data);
  },

  addSpecialRequest(orderId: string, itemId: string, data: AddSpecialRequestRequest) {
    return apiClient.post(`/orders/${orderId}/items/${itemId}/special-requests`, data);
  },

  removeSpecialRequest(orderId: string, itemId: string, specialRequestId: string) {
    return apiClient.delete(`/orders/${orderId}/items/${itemId}/special-requests/${specialRequestId}`);
  },

  overrideComplexity(orderId: string, itemId: string, processId: string, data: OverrideComplexityRequest) {
    return apiClient.put(`/orders/${orderId}/items/${itemId}/processes/${processId}/complexity`, data);
  },
};
