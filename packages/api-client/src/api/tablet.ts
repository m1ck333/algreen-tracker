import type {
  TabletQueueItemDto,
  TabletActiveWorkDto,
  TabletIncomingDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const tabletApi = {
  getQueue(processId: string, tenantId: string) {
    return apiClient.get<TabletQueueItemDto[]>('/tablet/queue', {
      params: { processId, tenantId },
    });
  },

  getActive(processId: string, tenantId: string) {
    return apiClient.get<TabletActiveWorkDto[]>('/tablet/active', {
      params: { processId, tenantId },
    });
  },

  getIncoming(processId: string, tenantId: string) {
    return apiClient.get<TabletIncomingDto[]>('/tablet/incoming', {
      params: { processId, tenantId },
    });
  },
};
