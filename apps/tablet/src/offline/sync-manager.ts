import { useOfflineStore } from './offline-store';

export async function syncPendingActions(): Promise<void> {
  const store = useOfflineStore.getState();
  if (!store.isOnline || store.pendingActions.length === 0) return;

  for (const action of store.pendingActions) {
    try {
      // Route to appropriate API call based on action type
      switch (action.type) {
        case 'check-in':
        case 'check-out':
        case 'start-work':
        case 'stop-work':
          // These will be implemented when offline-first patterns are needed
          console.log('Syncing action:', action.type, action.payload);
          break;
        default:
          console.warn('Unknown action type:', action.type);
      }
      store.removePendingAction(action.id);
    } catch (err) {
      console.error('Failed to sync action:', action.id, err);
      break; // Stop processing to maintain order
    }
  }
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnline(true);
    syncPendingActions();
  });

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnline(false);
  });
}
