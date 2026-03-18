import type {
  TabletQueueItemDto,
  TabletActiveWorkDto,
  TabletIncomingDto,
  ProcessGroupDto,
} from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const tabletApi = {
  getQueue(userId: string, tenantId: string) {
    return apiClient.get<ProcessGroupDto<TabletQueueItemDto>[]>('/tablet/queue', {
      params: { userId, tenantId },
    });
  },

  getActive(userId: string, tenantId: string) {
    return apiClient.get<ProcessGroupDto<TabletActiveWorkDto>[]>('/tablet/active', {
      params: { userId, tenantId },
    });
  },

  getIncoming(userId: string, tenantId: string) {
    return apiClient.get<ProcessGroupDto<TabletIncomingDto>[]>('/tablet/incoming', {
      params: { userId, tenantId },
    });
  },

  pause(userId: string) {
    return apiClient.post('/tablet/pause', null, {
      params: { userId },
    });
  },
};
