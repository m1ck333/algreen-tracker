import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkSessionState {
  processId: string | null;
  setProcessId: (processId: string) => void;
  clear: () => void;
}

export const useWorkSessionStore = create<WorkSessionState>()(
  persist(
    (set) => ({
      processId: null,
      setProcessId: (processId) => set({ processId }),
      clear: () => set({ processId: null }),
    }),
    { name: 'algreen-work-session' },
  ),
);
