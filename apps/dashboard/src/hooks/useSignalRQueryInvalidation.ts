import { useQueryClient } from '@tanstack/react-query';
import { useSignalREvent, SignalREvents } from '@algreen/signalr-client';

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* ignore if audio not available */ }
}

export function useSignalRQueryInvalidation() {
  const queryClient = useQueryClient();

  useSignalREvent(SignalREvents.OrderActivated, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessStarted, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
  });

  useSignalREvent(SignalREvents.ProcessCompleted, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessBlocked, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.ProcessUnblocked, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
  });

  useSignalREvent(SignalREvents.BlockRequestCreated, () => {
    playAlertSound();
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  useSignalREvent(SignalREvents.BlockRequestApproved, () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'pending-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests'] });
    queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
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

  useSignalREvent(SignalREvents.OrderUpdated, () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'live-view'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'statistics'] });
  });

  useSignalREvent(SignalREvents.ProcessDefinitionUpdated, () => {
    queryClient.invalidateQueries({ queryKey: ['processes'] });
    queryClient.invalidateQueries({ queryKey: ['processes-batch'] });
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
  });
}
