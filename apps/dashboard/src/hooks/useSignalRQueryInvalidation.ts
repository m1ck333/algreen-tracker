import { useQueryClient } from '@tanstack/react-query';
import { useSignalREvent, SignalREvents } from '@algreen/signalr-client';

export function useSignalRQueryInvalidation() {
  const queryClient = useQueryClient();

  useSignalREvent(SignalREvents.OrderActivated, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessStarted, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
  });

  useSignalREvent(SignalREvents.ProcessCompleted, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessBlocked, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessUnblocked, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
  });

  useSignalREvent(SignalREvents.BlockRequestCreated, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.BlockRequestApproved, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.WorkerCheckedIn, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'workers-status'] });
  });

  useSignalREvent(SignalREvents.WorkerCheckedOut, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'workers-status'] });
  });

  useSignalREvent(SignalREvents.DeadlineWarning, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'warnings'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });
}
