import { create } from 'zustand';

interface LayoutState {
  fullscreen: boolean;
  setFullscreen: (value: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  fullscreen: false,
  setFullscreen: (value) => set({ fullscreen: value }),
}));
