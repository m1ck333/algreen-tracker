import { pushApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';

const VAPID_KEY_STORAGE = 'algreen_vapid_public_key';

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
      console.warn('[Push] serviceWorker or PushManager not supported');
      return false;
    }

    const permission = await Notification.requestPermission();
    console.log('[Push] Notification permission:', permission);
    if (permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] Service worker ready, scope:', registration.scope);

    // Fetch current VAPID public key from server (must succeed before any subscribe attempt)
    let vapidPublicKey: string;
    try {
      const { data } = await pushApi.getVapidPublicKey();
      vapidPublicKey = data.publicKey;
    } catch (err) {
      console.error('[Push] Failed to fetch VAPID public key from server, skipping subscribe:', err);
      return false;
    }
    console.log('[Push] VAPID public key received:', vapidPublicKey ? 'yes' : 'no');
    if (!vapidPublicKey) return false;

    // Compare server key against cached key to detect rotation
    const cachedKey = localStorage.getItem(VAPID_KEY_STORAGE);
    const existing = await registration.pushManager.getSubscription();
    const keyMatches = cachedKey !== null && cachedKey === vapidPublicKey;

    let subscription = existing;
    if (existing && !keyMatches) {
      // Either no cache (first run after this patch) or server key changed → force clean re-subscribe
      console.info(cachedKey === null
        ? '[Push] No cached VAPID key, treating as unknown state, forcing re-subscribe'
        : '[Push] VAPID key changed, forcing re-subscribe');
      try {
        await existing.unsubscribe();
      } catch (err) {
        console.warn('[Push] existing.unsubscribe() failed:', err);
      }
      localStorage.removeItem(VAPID_KEY_STORAGE);
      subscription = null;
    } else if (existing && keyMatches) {
      console.info('[Push] VAPID key unchanged, reusing existing subscription');
    } else {
      console.info('[Push] No existing browser subscription, creating new one');
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });
    }

    const json = subscription.toJSON();
    console.log('[Push] Subscription endpoint:', json.endpoint?.slice(0, 60) + '...');
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.warn('[Push] Subscription missing keys');
      return false;
    }

    // Register subscription on the server (tenant derived from JWT)
    const { user } = useAuthStore.getState();
    if (!user?.id) {
      console.warn('[Push] No userId in auth store');
      return false;
    }

    await pushApi.subscribe({
      userId: user.id,
      endpoint: json.endpoint,
      p256dhKey: json.keys.p256dh,
      authKey: json.keys.auth,
    });

    // Cache the public key the subscription was generated against, so the next login can detect rotation
    localStorage.setItem(VAPID_KEY_STORAGE, vapidPublicKey);
    console.info('[Push] Subscription registered on server successfully, VAPID key cached');
    return true;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;

    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 3000)),
    ]);
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // Even if there's no browser subscription, clean any stale cached key for next login
      localStorage.removeItem(VAPID_KEY_STORAGE);
      return;
    }

    // Unregister on server
    try {
      await pushApi.unsubscribe(subscription.endpoint);
    } catch {
      // Server may be unreachable, continue with local unsubscribe
    }

    await subscription.unsubscribe();
    localStorage.removeItem(VAPID_KEY_STORAGE);
    console.log('[Push] Unsubscribed successfully');
  } catch (err) {
    console.warn('[Push] Unsubscribe failed:', err);
  }
}
