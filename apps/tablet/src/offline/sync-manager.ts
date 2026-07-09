import { processWorkflowApi, subProcessWorkflowApi } from '@alblue/api-client';
import { OFFLINE_WRITES_ENABLED } from './config';
import { useOfflineStore, type PendingWorkflowAction } from './offline-store';
import { isNetworkError } from './is-network-error';
import { queryClient } from '../query-client';

async function replayAction(a: PendingWorkflowAction): Promise<void> {
  // a.id is reused as the idempotency actionId so a replay the server already
  // saw (e.g. its response was lost) is a no-op rather than a double-apply.
  const meta = { actionId: a.id, occurredAt: a.occurredAt };
  switch (a.type) {
    case 'start-process':
      await processWorkflowApi.start(a.targetId, { userId: a.userId, ...meta });
      break;
    case 'stop-process':
      await processWorkflowApi.stop(a.targetId, { userId: a.userId, ...meta });
      break;
    case 'resume-process':
      await processWorkflowApi.resume(a.targetId, { userId: a.userId, ...meta });
      break;
    case 'complete-process':
      await processWorkflowApi.complete(a.targetId, meta);
      break;
    case 'start-subprocess':
      await subProcessWorkflowApi.start(a.targetId, { userId: a.userId, ...meta });
      break;
    case 'complete-subprocess':
      await subProcessWorkflowApi.complete(a.targetId, { userId: a.userId, ...meta });
      break;
  }
}

let syncing = false;

/**
 * Replays queued offline actions oldest-first, preserving order. Called on
 * reconnect and app start. Idempotent and re-entrancy-guarded.
 *
 * - Network error mid-replay → stop and keep the rest queued (retry next time),
 *   so ordering is never broken.
 * - Server rejection (4xx/5xx) → the action can't be applied (state moved on);
 *   drop it so it doesn't wedge the queue. Worker-facing surfacing of dropped
 *   actions is a later milestone.
 */
export async function syncPendingActions(): Promise<void> {
  if (!OFFLINE_WRITES_ENABLED || syncing || !navigator.onLine) return;
  if (useOfflineStore.getState().pendingActions.length === 0) return;

  syncing = true;
  let drained = false;
  try {
    for (const action of [...useOfflineStore.getState().pendingActions]) {
      try {
        await replayAction(action);
        useOfflineStore.getState().removePendingAction(action.id);
        drained = true;
      } catch (err) {
        if (isNetworkError(err)) break; // connection lost again — retry later
        // Server rejected the replay (state moved on). Drop it from the queue
        // and record it as failed so the worker can be told — never silent.
        console.warn('[offline] rejected action', action.type, action.targetId, err);
        useOfflineStore.getState().recordFailed({
          id: action.id,
          type: action.type,
          targetId: action.targetId,
        });
        useOfflineStore.getState().removePendingAction(action.id);
        drained = true;
      }
    }
  } finally {
    syncing = false;
    if (drained) {
      // Refresh the tablet views with server truth after the queue drains.
      void queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
      void queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['tablet-incoming'] });
    }
  }
}
