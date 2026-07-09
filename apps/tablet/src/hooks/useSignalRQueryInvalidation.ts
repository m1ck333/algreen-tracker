import { useQueryClient } from '@tanstack/react-query';
import { useSignalREvent, SignalREvents } from '@alblue/signalr-client';

export function useSignalRQueryInvalidation() {
  const queryClient = useQueryClient();

  useSignalREvent(SignalREvents.OrderActivated, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
  });

  useSignalREvent(SignalREvents.ProcessStarted, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
  });

  useSignalREvent(SignalREvents.ProcessCompleted, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
  });

  useSignalREvent(SignalREvents.ProcessBlocked, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
  });

  useSignalREvent(SignalREvents.ProcessUnblocked, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
  });

  useSignalREvent(SignalREvents.BlockRequestApproved, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
  });

  useSignalREvent(SignalREvents.ProcessReadyForQueue, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
  });

  useSignalREvent(SignalREvents.OrderUpdated, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
  });

  useSignalREvent(SignalREvents.ProcessDefinitionUpdated, () => {
    // Actual keys the tablet uses for process definitions — 'processes-batch'
    // matched nothing (queue uses 'tablet-process-definitions', incoming uses
    // 'processes'), so process renames/reordering stayed stale for workers.
    queryClient.invalidateQueries({ queryKey: ['tablet-process-definitions'] });
    queryClient.invalidateQueries({ queryKey: ['processes'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
  });
}
