import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./config', () => ({ OFFLINE_WRITES_ENABLED: true }));
vi.mock('../query-client', () => ({ queryClient: { invalidateQueries: vi.fn() } }));

const mocks = vi.hoisted(() => ({
  startProcess: vi.fn(),
  stopProcess: vi.fn(),
  completeProcess: vi.fn(),
  startSub: vi.fn(),
  completeSub: vi.fn(),
}));

vi.mock('@alblue/api-client', () => ({
  processWorkflowApi: {
    start: mocks.startProcess,
    stop: mocks.stopProcess,
    complete: mocks.completeProcess,
  },
  subProcessWorkflowApi: {
    start: mocks.startSub,
    complete: mocks.completeSub,
  },
}));

import { syncPendingActions } from './sync-manager';
import { useOfflineStore, type PendingWorkflowAction } from './offline-store';

const action = (over: Partial<PendingWorkflowAction>): PendingWorkflowAction => ({
  id: 'a1', type: 'start-process', targetId: 'p1', userId: 'u1', occurredAt: 'T0', enqueuedAt: 1, ...over,
});

describe('syncPendingActions', () => {
  beforeEach(() => {
    useOfflineStore.setState({ pendingActions: [], failedActions: [] });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    Object.values(mocks).forEach((m) => m.mockReset().mockResolvedValue(undefined));
  });

  it('replays queued actions in order with their actionId + occurredAt, then drains the queue', async () => {
    useOfflineStore.setState({
      pendingActions: [
        action({ id: 'a1', type: 'start-process', targetId: 'p1', occurredAt: 'T0' }),
        action({ id: 'a2', type: 'complete-process', targetId: 'p1', occurredAt: 'T1' }),
      ],
    });

    await syncPendingActions();

    expect(mocks.startProcess).toHaveBeenCalledWith('p1', { userId: 'u1', actionId: 'a1', occurredAt: 'T0' });
    expect(mocks.completeProcess).toHaveBeenCalledWith('p1', { actionId: 'a2', occurredAt: 'T1' });
    expect(useOfflineStore.getState().pendingActions).toHaveLength(0);
  });

  it('stops on a network error and keeps the rest queued in order', async () => {
    mocks.startProcess.mockRejectedValueOnce({ isAxiosError: true, response: undefined });
    useOfflineStore.setState({
      pendingActions: [
        action({ id: 'a1', type: 'start-process' }),
        action({ id: 'a2', type: 'complete-process' }),
      ],
    });

    await syncPendingActions();

    expect(mocks.completeProcess).not.toHaveBeenCalled();
    expect(useOfflineStore.getState().pendingActions.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('drops a server-rejected action and continues with the rest', async () => {
    mocks.startProcess.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400 } });
    useOfflineStore.setState({
      pendingActions: [
        action({ id: 'a1', type: 'start-process', targetId: 'p1' }),
        action({ id: 'a2', type: 'start-subprocess', targetId: 's1', occurredAt: 'T1' }),
      ],
    });

    await syncPendingActions();

    expect(mocks.startSub).toHaveBeenCalledWith('s1', { userId: 'u1', actionId: 'a2', occurredAt: 'T1' });
    expect(useOfflineStore.getState().pendingActions).toHaveLength(0); // a1 dropped, a2 done
    // the rejected a1 is recorded as failed (surfaced to the worker, not silent)
    const failed = useOfflineStore.getState().failedActions;
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ id: 'a1', type: 'start-process', targetId: 'p1' });
  });

  it('does nothing while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useOfflineStore.setState({ pendingActions: [action({ id: 'a1' })] });

    await syncPendingActions();

    expect(mocks.startProcess).not.toHaveBeenCalled();
    expect(useOfflineStore.getState().pendingActions).toHaveLength(1);
  });
});
