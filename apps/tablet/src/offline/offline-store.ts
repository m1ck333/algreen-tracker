import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The five tablet workflow actions that can be performed offline and replayed.
export type WorkflowActionType =
  | 'start-process'
  | 'stop-process'
  | 'resume-process'
  | 'complete-process'
  | 'start-subprocess'
  | 'complete-subprocess';

export interface PendingWorkflowAction {
  /** Unique id of this queue entry. Doubles as the server idempotency key
   *  (actionId), so an action replayed after a flaky send applies exactly once. */
  id: string;
  type: WorkflowActionType;
  /** OrderItemProcess id (process actions) or sub-process id (sub actions). */
  targetId: string;
  userId: string;
  /** ISO timestamp captured at the moment the worker tapped. */
  occurredAt: string;
  enqueuedAt: number;
}

/** A queued action the server rejected on replay (state moved on). Kept so the
 *  worker can be told it didn't go through, rather than it vanishing silently. */
export interface FailedAction {
  id: string;
  type: WorkflowActionType;
  targetId: string;
  failedAt: number;
}

interface OfflineState {
  isOnline: boolean;
  pendingActions: PendingWorkflowAction[];
  failedActions: FailedAction[];
  setOnline: (online: boolean) => void;
  enqueue: (action: Omit<PendingWorkflowAction, 'enqueuedAt'>) => void;
  removePendingAction: (id: string) => void;
  clearPendingActions: () => void;
  recordFailed: (action: Omit<FailedAction, 'failedAt'>) => void;
  clearFailedActions: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      pendingActions: [],
      failedActions: [],

      setOnline: (online) => set({ isOnline: online }),

      enqueue: (action) =>
        set((state) => ({
          pendingActions: [
            ...state.pendingActions,
            { ...action, enqueuedAt: Date.now() },
          ],
        })),

      removePendingAction: (id) =>
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => a.id !== id),
        })),

      clearPendingActions: () => set({ pendingActions: [] }),

      recordFailed: (action) =>
        set((state) => ({
          failedActions: [...state.failedActions, { ...action, failedAt: Date.now() }],
        })),

      clearFailedActions: () => set({ failedActions: [] }),
    }),
    {
      // Persisted to localStorage so a queued / failed action survives an app
      // reload / device sleep while offline.
      name: 'alblue-offline',
      partialize: (state) => ({
        pendingActions: state.pendingActions,
        failedActions: state.failedActions,
      }),
    },
  ),
);
