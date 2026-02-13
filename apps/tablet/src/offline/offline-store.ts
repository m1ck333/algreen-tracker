import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PendingAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

interface OfflineState {
  isOnline: boolean;
  pendingActions: PendingAction[];
  setOnline: (online: boolean) => void;
  addPendingAction: (type: string, payload: unknown) => void;
  removePendingAction: (id: string) => void;
  clearPendingActions: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      pendingActions: [],

      setOnline: (online) => set({ isOnline: online }),

      addPendingAction: (type, payload) =>
        set((state) => ({
          pendingActions: [
            ...state.pendingActions,
            {
              id: crypto.randomUUID(),
              type,
              payload,
              timestamp: Date.now(),
            },
          ],
        })),

      removePendingAction: (id) =>
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => a.id !== id),
        })),

      clearPendingActions: () => set({ pendingActions: [] }),
    }),
    {
      name: 'algreen-offline',
    },
  ),
);
