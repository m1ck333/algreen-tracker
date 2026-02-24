import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkSessionState {
  processId: string | null;
  processName: string | null;
  checkInTime: string | null;
  setProcessId: (processId: string) => void;
  setSessionInfo: (info: { processId: string; processName: string; checkInTime: string }) => void;
  clear: () => void;
}

export const useWorkSessionStore = create<WorkSessionState>()(
  persist(
    (set) => ({
      processId: null,
      processName: null,
      checkInTime: null,
      setProcessId: (processId) => set({ processId }),
      setSessionInfo: ({ processId, processName, checkInTime }) =>
        set({ processId, processName, checkInTime }),
      clear: () => set({ processId: null, processName: null, checkInTime: null }),
    }),
    { name: 'algreen-work-session' },
  ),
);
