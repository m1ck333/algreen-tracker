import type { OrderItemSubProcessDto } from '@alblue/shared-types';
import type {
  StartSubProcessRequest,
  CompleteSubProcessRequest,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const subProcessWorkflowApi = {
  start(id: string, data: StartSubProcessRequest) {
    return apiClient.post<OrderItemSubProcessDto>(`/order-item-sub-processes/${id}/start`, data);
  },

  complete(id: string, data: CompleteSubProcessRequest) {
    return apiClient.post<OrderItemSubProcessDto>(`/order-item-sub-processes/${id}/complete`, data);
  },
};
