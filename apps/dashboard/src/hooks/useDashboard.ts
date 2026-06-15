import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, changeRequestsApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { RequestStatus } from '@alblue/shared-types';
import { useSignalREvent, SignalREvents } from '@alblue/signalr-client';

// Polling intervals are kept as a safety net for missed SignalR events
// (reconnect mid-event, hub outage, ...). The SignalR sync hook below
// invalidates these queries on the relevant events so the screen feels
// live without waiting for the next polling tick.
const SAFETY_NET_FAST = 120_000;
const SAFETY_NET_SLOW = 300_000;

export function useDashboardWarnings() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'warnings', tenantId],
    queryFn: () => dashboardApi.getWarnings().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_SLOW,
  });
}

export function useDashboardLiveView() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'live-view', tenantId],
    queryFn: () => dashboardApi.getLiveView().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_FAST,
  });
}

export function useDashboardWorkersStatus() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'workers-status', tenantId],
    queryFn: () => dashboardApi.getWorkersStatus().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_FAST,
  });
}

export function useDashboardPendingBlocks() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'pending-blocks', tenantId],
    queryFn: () => dashboardApi.getPendingBlocks().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_FAST,
  });
}

export function useDashboardStatistics() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'statistics', tenantId],
    queryFn: () => dashboardApi.getStatistics().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_SLOW,
  });
}

export function usePendingChangeRequests() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: ['dashboard', 'pending-change-requests', tenantId],
    queryFn: () =>
      changeRequestsApi
        .getAll({ status: RequestStatus.Pending })
        .then((r) => r.data.items),
    enabled: !!tenantId,
    refetchInterval: SAFETY_NET_FAST,
  });
}

/**
 * SignalR push for the coordinator's live dashboard. Subscribe once at the top
 * of the dashboard page; the BE events get translated to query-cache
 * invalidations so the cards/lists refresh within ~1s of any state change
 * instead of waiting for the polling tick.
 *
 * NotificationCreated already covers everything that writes a notification
 * (OrderActivated, ProcessCompleted, ProcessBlocked, BlockRequestCreated/
 * Approved/Rejected, DeadlineWarning, WorkerAutoLoggedOut) by invalidating
 * the `dashboard` parent key. The other handlers below cover events that
 * change dashboard state but don't write a notification.
 */
export function useDashboardSignalRSync() {
  const queryClient = useQueryClient();

  const invalidateLiveView = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
  }, [queryClient]);
  const invalidateWorkers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'workers-status'] });
  }, [queryClient]);
  const invalidateBlocks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
  }, [queryClient]);
  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    // The coordinator dashboard's low-stock badge reads from warehouse-stock.
    // MaterialLowStock fires NotificationCreated when stock crosses min, so
    // we invalidate that cache here too — otherwise the badge sits on a stale
    // count until the next polling tick.
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
  }, [queryClient]);

  // Notifications fire on most state changes that affect dashboard cards.
  useSignalREvent(SignalREvents.NotificationCreated, invalidateDashboard);

  // Events that don't write a notification but do change live state:
  useSignalREvent(SignalREvents.ProcessStarted, invalidateLiveView);
  useSignalREvent(SignalREvents.ProcessUnblocked, () => {
    invalidateLiveView();
    invalidateBlocks();
  });
  useSignalREvent(SignalREvents.OrderUpdated, invalidateLiveView);
  useSignalREvent(SignalREvents.WorkerCheckedIn, invalidateWorkers);
  useSignalREvent(SignalREvents.WorkerCheckedOut, invalidateWorkers);
}
