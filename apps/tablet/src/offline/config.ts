// Master switch for offline *writes* (queue + replay of workflow actions).
// Default OFF: when false the tablet behaves exactly as it always has —
// actions call the API directly and a failure surfaces as an error. Flip to
// true (per-deploy, once QA-cleared) to enable offline queueing.
//
// Offline *reads* (query cache persistence) are always on and independent of
// this flag — they can't corrupt anything.
export const OFFLINE_WRITES_ENABLED =
  import.meta.env.VITE_OFFLINE_WRITES === 'true';
