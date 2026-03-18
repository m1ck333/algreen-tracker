import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkSessionState {
  checkInTime: string | null;
  setCheckInTime: (checkInTime: string) => void;
  clear: () => void;
}

export const useWorkSessionStore = create<WorkSessionState>()(
  persist(
    (set) => ({
      checkInTime: null,
      setCheckInTime: (checkInTime) => set({ checkInTime }),
      clear: () => set({ checkInTime: null }),
    }),
    { name: 'algreen-work-session' },
  ),
);
