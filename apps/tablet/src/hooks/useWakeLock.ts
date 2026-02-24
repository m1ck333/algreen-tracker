import { useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';

/**
 * Keeps the screen awake on iOS and Android tablets.
 * Uses nosleep.js which handles all platform quirks (silent video on iOS, Wake Lock API on others).
 * Must be enabled after a user interaction (tap) — we enable on first touchstart.
 */
export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const noSleep = new NoSleep();
    noSleepRef.current = noSleep;

    const enableOnInteraction = () => {
      if (!enabledRef.current) {
        noSleep.enable().catch(() => {});
        enabledRef.current = true;
      }
    };

    // iOS requires user gesture to start video/wake lock
    document.addEventListener('touchstart', enableOnInteraction, { once: true });
    document.addEventListener('click', enableOnInteraction, { once: true });

    // Re-enable after tab comes back to foreground
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        noSleep.enable().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('touchstart', enableOnInteraction);
      document.removeEventListener('click', enableOnInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      noSleep.disable();
      noSleepRef.current = null;
      enabledRef.current = false;
    };
  }, []);
}
