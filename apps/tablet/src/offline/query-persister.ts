import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Persists the TanStack Query cache to localStorage so the tablet can render
// the worker's queue / active work / incoming list when the network is down
// (spotty factory wifi). Reads only — this does NOT make mutations work
// offline; that is a later milestone behind its own flag.

// localStorage key holding the dehydrated query cache. Exported so logout can
// wipe it — otherwise one worker's cached queue would linger on the shared
// device. (Cross-worker *display* is already impossible because tablet query
// keys are scoped by userId, but we still clear it to avoid PII at rest.)
export const QUERY_CACHE_KEY = 'mpms-tablet-query-cache';

// Bump when persisted query shapes change, so a release that alters a DTO
// discards the now-incompatible cache on first load instead of rendering it.
export const QUERY_CACHE_BUSTER = 'v1';

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_CACHE_KEY,
  // Throttle writes so rapid cache churn doesn't hammer localStorage.
  throttleTime: 1_000,
});

/** Remove the persisted query cache. Called on logout. */
export function clearPersistedQueryCache(): void {
  try {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    /* localStorage unavailable (private mode / quota) — nothing to clear */
  }
}
