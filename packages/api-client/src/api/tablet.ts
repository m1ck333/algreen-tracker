import type {
  TabletQueueItemDto,
  TabletActiveWorkDto,
  TabletIncomingDto,
  ProcessGroupDto,
} from '@alblue/shared-types';
import { apiClient } from '../axios-instance';

export const tabletApi = {
  getQueue(userId: string) {
    return apiClient.get<ProcessGroupDto<TabletQueueItemDto>[]>('/tablet/queue', {
      params: { userId },
    });
  },

  getActive(userId: string) {
    return apiClient.get<ProcessGroupDto<TabletActiveWorkDto>[]>('/tablet/active', {
      params: { userId },
    });
  },

  getIncoming(userId: string) {
    return apiClient.get<ProcessGroupDto<TabletIncomingDto>[]>('/tablet/incoming', {
      params: { userId },
    });
  },

  pause(userId: string) {
    return apiClient.post('/tablet/pause', null, {
      params: { userId },
    });
  },
};
