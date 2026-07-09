import { useEffect } from 'react';
import { OFFLINE_WRITES_ENABLED } from './config';
import { useOfflineStore } from './offline-store';
import { syncPendingActions } from './sync-manager';

/**
 * Keeps the offline write engine live for as long as it's mounted (the whole
 * tablet app, via TabletLayout): tracks connectivity into the store and
 * replays the queue when the network returns or the app starts online.
 * A no-op when offline writes are disabled.
 */
export function useOfflineSync(): void {
  useEffect(() => {
    if (!OFFLINE_WRITES_ENABLED) return;

    const setOnline = useOfflineStore.getState().setOnline;

    const handleOnline = () => {
      setOnline(true);
      void syncPendingActions();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Drain anything left over from a previous offline session on startup.
    if (navigator.onLine) void syncPendingActions();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}
