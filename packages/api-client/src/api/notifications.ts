import type { NotificationDto } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export const notificationsApi = {
  getAll(userId: string) {
    return apiClient.get<NotificationDto[]>('/notifications', { params: { userId } });
  },

  getUnreadCount(userId: string) {
    return apiClient.get<number>('/notifications/unread-count', { params: { userId } });
  },

  markAsRead(id: string) {
    return apiClient.post(`/notifications/${id}/read`);
  },

  markAllAsRead(userId: string) {
    return apiClient.post('/notifications/read-all', null, { params: { userId } });
  },
};
