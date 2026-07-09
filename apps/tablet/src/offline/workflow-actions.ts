import { OFFLINE_WRITES_ENABLED } from './config';
import { useOfflineStore, type WorkflowActionType } from './offline-store';
import { isNetworkError } from './is-network-error';

export interface RunWorkflowActionArgs {
  type: WorkflowActionType;
  /** OrderItemProcess id (process actions) or sub-process id (sub actions). */
  targetId: string;
  userId: string;
  /**
   * Performs the actual API call, merging in the offline metadata. `meta` is
   * empty when offline writes are disabled (so the call is byte-for-byte the
   * legacy one) and carries actionId + occurredAt otherwise.
   */
  call: (meta: { actionId?: string; occurredAt?: string }) => Promise<unknown>;
}

export type RunResult = { status: 'done' } | { status: 'queued' };

/**
 * Runs a tablet workflow action with offline support.
 *
 * - Flag off → calls the API directly with no metadata (identical to legacy).
 * - Offline at tap time → queues the action, returns 'queued' (no network hit).
 * - Online but the connection drops mid-request (no HTTP reply) → queues for
 *   replay under the same actionId, so the server applies it exactly once.
 * - A real HTTP error (server answered 4xx/5xx) → rethrown as a genuine failure.
 */
export async function runWorkflowAction(args: RunWorkflowActionArgs): Promise<RunResult> {
  if (!OFFLINE_WRITES_ENABLED) {
    await args.call({});
    return { status: 'done' };
  }

  const actionId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();

  const queue = () =>
    useOfflineStore.getState().enqueue({
      id: actionId,
      type: args.type,
      targetId: args.targetId,
      userId: args.userId,
      occurredAt,
    });

  if (!navigator.onLine) {
    queue();
    return { status: 'queued' };
  }

  try {
    await args.call({ actionId, occurredAt });
    return { status: 'done' };
  } catch (err) {
    if (isNetworkError(err)) {
      queue();
      return { status: 'queued' };
    }
    throw err;
  }
}
