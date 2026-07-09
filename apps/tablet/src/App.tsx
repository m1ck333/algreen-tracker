import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AppRoutes } from './routes';
import { queryClient } from './query-client';
import { queryPersister, QUERY_CACHE_BUSTER } from './offline/query-persister';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: ONE_DAY_MS, // discard caches older than a day
        buster: QUERY_CACHE_BUSTER,
      }}
    >
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
