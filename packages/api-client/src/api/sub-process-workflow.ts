import type { OrderItemSubProcessDto } from '@algreen/shared-types';
import type {
  StartSubProcessRequest,
  CompleteSubProcessRequest,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const subProcessWorkflowApi = {
  start(id: string, data: StartSubProcessRequest) {
    return apiClient.post<OrderItemSubProcessDto>(`/order-item-sub-processes/${id}/start`, data);
  },

  complete(id: string, data: CompleteSubProcessRequest) {
    return apiClient.post<OrderItemSubProcessDto>(`/order-item-sub-processes/${id}/complete`, data);
  },
};
