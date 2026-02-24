import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@algreen/auth';
import {
  createConnection,
  startConnection,
  joinTenantGroup,
  joinProcessGroup,
} from '@algreen/signalr-client';
import { tokenManager } from '@algreen/api-client';
import { BottomNav } from '../components/BottomNav';
import { OfflineBanner } from '../components/OfflineBanner';
import { StatusBar } from '../components/StatusBar';
import { useSignalRQueryInvalidation } from '../hooks/useSignalRQueryInvalidation';

export function TabletLayout() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useAuthStore((s) => s.user?.processId);
  useSignalRQueryInvalidation();

  useEffect(() => {
    const jwt = tokenManager.getToken();
    if (!jwt || !tenantId) return;

    let cancelled = false;

    createConnection(jwt);
    startConnection()
      .then(async () => {
        if (cancelled) return;
        await joinTenantGroup(tenantId);
        if (processId) await joinProcessGroup(processId);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [tenantId, processId]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <StatusBar />
      <OfflineBanner />
      <main className="flex-1 p-4 pb-24 overflow-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
