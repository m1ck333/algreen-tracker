import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
import { useWakeLock } from '../hooks/useWakeLock';

export function TabletLayout() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useAuthStore((s) => s.user?.processId);
  const navigate = useNavigate();
  useSignalRQueryInvalidation();
  useWakeLock();

  // Listen for SW postMessage navigation (iOS fallback)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'navigate' && event.data?.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [navigate]);

  useEffect(() => {
    const jwt = tokenManager.getToken();
    if (!jwt || !tenantId) return;

    let cancelled = false;

    const conn = createConnection(jwt);
    console.log('[SignalR] Connecting...');

    // Debug: log ALL incoming messages
    conn.on('OrderActivated', (d: unknown) => console.log('[SignalR] OrderActivated', d));
    conn.on('ProcessStarted', (d: unknown) => console.log('[SignalR] ProcessStarted', d));
    conn.on('ProcessCompleted', (d: unknown) => console.log('[SignalR] ProcessCompleted', d));
    conn.on('ProcessBlocked', (d: unknown) => console.log('[SignalR] ProcessBlocked', d));
    conn.on('ProcessReadyForQueue', (d: unknown) => console.log('[SignalR] ProcessReadyForQueue', d));

    startConnection()
      .then(async () => {
        if (cancelled) return;
        console.log('[SignalR] Connected. Joining groups...');
        await joinTenantGroup(tenantId);
        if (processId) await joinProcessGroup(processId);
        console.log('[SignalR] Joined tenant:', tenantId, 'process:', processId);
      })
      .catch((err) => console.error('[SignalR] Connection failed:', err));

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
