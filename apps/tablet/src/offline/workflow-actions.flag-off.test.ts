import { describe, it, expect, beforeEach, vi } from 'vitest';

// Flag OFF — the production default. Offline logic must be fully bypassed.
vi.mock('./config', () => ({ OFFLINE_WRITES_ENABLED: false }));

import { runWorkflowAction } from './workflow-actions';
import { useOfflineStore } from './offline-store';

describe('runWorkflowAction (offline writes disabled)', () => {
  beforeEach(() => useOfflineStore.setState({ pendingActions: [] }));

  it('calls the API with empty meta and never queues — even when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const call = vi.fn().mockResolvedValue(undefined);

    const res = await runWorkflowAction({ type: 'start-process', targetId: 'p1', userId: 'u1', call });

    expect(res.status).toBe('done');
    expect(call).toHaveBeenCalledWith({}); // no actionId/occurredAt — legacy call
    expect(useOfflineStore.getState().pendingActions).toHaveLength(0);
  });
});
