import { describe, it, expect, beforeEach, vi } from 'vitest';

// Force the feature flag ON for this file.
vi.mock('./config', () => ({ OFFLINE_WRITES_ENABLED: true }));

import { runWorkflowAction } from './workflow-actions';
import { useOfflineStore } from './offline-store';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('runWorkflowAction (offline writes enabled)', () => {
  beforeEach(() => {
    useOfflineStore.setState({ pendingActions: [] });
    setOnline(true);
  });

  it('online success: calls API with actionId + occurredAt and does not queue', async () => {
    const call = vi.fn().mockResolvedValue(undefined);
    const res = await runWorkflowAction({ type: 'start-process', targetId: 'p1', userId: 'u1', call });

    expect(res.status).toBe('done');
    expect(call).toHaveBeenCalledOnce();
    const meta = call.mock.calls[0][0];
    expect(meta.actionId).toMatch(/[0-9a-f-]{36}/);
    expect(meta.occurredAt).toBeTruthy();
    expect(useOfflineStore.getState().pendingActions).toHaveLength(0);
  });

  it('offline: queues the action without hitting the network', async () => {
    setOnline(false);
    const call = vi.fn();
    const res = await runWorkflowAction({ type: 'complete-process', targetId: 'p1', userId: 'u1', call });

    expect(res.status).toBe('queued');
    expect(call).not.toHaveBeenCalled();
    const queue = useOfflineStore.getState().pendingActions;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ type: 'complete-process', targetId: 'p1', userId: 'u1' });
    expect(queue[0].occurredAt).toBeTruthy();
  });

  it('network error mid-request (lost response): queues for replay', async () => {
    const call = vi.fn().mockRejectedValue({ isAxiosError: true, response: undefined });
    const res = await runWorkflowAction({ type: 'stop-process', targetId: 'p1', userId: 'u1', call });

    expect(res.status).toBe('queued');
    expect(useOfflineStore.getState().pendingActions).toHaveLength(1);
  });

  it('HTTP error (server answered 4xx/5xx): rethrows and does not queue', async () => {
    const httpErr = { isAxiosError: true, response: { status: 400 } };
    const call = vi.fn().mockRejectedValue(httpErr);

    await expect(
      runWorkflowAction({ type: 'start-process', targetId: 'p1', userId: 'u1', call }),
    ).rejects.toBe(httpErr);
    expect(useOfflineStore.getState().pendingActions).toHaveLength(0);
  });
});
