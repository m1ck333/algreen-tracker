import { QueryClient } from '@tanstack/react-query';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Shared QueryClient instance. Lives in its own module (rather than inline in
// App.tsx) so non-React code — notably the offline sync manager, which
// invalidates queries after replaying queued actions — can reach it.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep data in memory long enough to be persisted and restored for
      // offline use. The default gcTime (5 min) would evict it well before a
      // worker reopens the app after a wifi drop.
      gcTime: ONE_DAY_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
