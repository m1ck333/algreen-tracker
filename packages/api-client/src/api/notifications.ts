import type { NotificationDto, PagedResult } from '@algreen/shared-types';
import { apiClient } from '../axios-instance';

export interface NotificationsQuery {
  userId: string;
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  search?: string;
}

export const notificationsApi = {
  getAll(params: NotificationsQuery) {
    return apiClient.get<PagedResult<NotificationDto>>('/notifications', { params });
  },

  getUnreadCount(userId: string) {
    return apiClient.get<number>('/notifications/unread-count', { params: { userId } });
  },

  markAsRead(id: string) {
    return apiClient.post(`/notifications/${id}/read`);
  },

  markAsUnread(id: string) {
    return apiClient.post(`/notifications/${id}/unread`);
  },

  markAllAsRead(userId: string) {
    return apiClient.post('/notifications/read-all', null, { params: { userId } });
  },

  delete(id: string) {
    return apiClient.delete(`/notifications/${id}`);
  },

  deleteAll(userId: string) {
    return apiClient.delete('/notifications', { params: { userId } });
  },
};
