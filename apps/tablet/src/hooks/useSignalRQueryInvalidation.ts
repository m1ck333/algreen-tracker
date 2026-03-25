import { useQueryClient } from '@tanstack/react-query';
import { useSignalREvent, SignalREvents } from '@algreen/signalr-client';

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
    queryClient.invalidateQueries({ queryKey: ['processes-batch'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
  });
}
