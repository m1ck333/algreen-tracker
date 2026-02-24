import { apiClient } from '../axios-instance';

export const pushApi = {
  getVapidPublicKey() {
    return apiClient.get<{ publicKey: string }>('/push/vapid-public-key');
  },

  subscribe(data: { tenantId: string; userId: string; endpoint: string; p256dhKey: string; authKey: string }) {
    return apiClient.post('/push/subscribe', data);
  },

  unsubscribe(endpoint: string) {
    return apiClient.delete('/push/unsubscribe', { params: { endpoint } });
  },
};
