import { pushApi } from '@algreen/api-client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Get VAPID key from server
    const { data: vapidPublicKey } = await pushApi.getVapidPublicKey();
    if (!vapidPublicKey) return false;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return false;
    }

    // Register subscription on the server
    await pushApi.subscribe({
      endpoint: json.endpoint,
      p256dhKey: json.keys.p256dh,
      authKey: json.keys.auth,
    });

    return true;
  } catch (err) {
    console.warn('Push subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Unregister on server
    try {
      await pushApi.unsubscribe(subscription.endpoint);
    } catch {
      // Server may be unreachable, continue with local unsubscribe
    }

    await subscription.unsubscribe();
  } catch (err) {
    console.warn('Push unsubscribe failed:', err);
  }
}
