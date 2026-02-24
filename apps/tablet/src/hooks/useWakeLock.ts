import { useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';

/**
 * Keeps the screen awake on iOS and Android tablets.
 * Uses nosleep.js which handles platform quirks (silent video on iOS, Wake Lock API on others).
 * Re-enables on every touch and periodically to combat iOS killing the video.
 */
export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null);

  useEffect(() => {
    const noSleep = new NoSleep();
    noSleepRef.current = noSleep;

    const enable = () => {
      noSleep.enable().catch(() => {});
    };

    // Re-enable on every touch — iOS can kill the video at any time
    document.addEventListener('touchstart', enable);
    document.addEventListener('click', enable);

    // Re-enable when tab comes back to foreground
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        enable();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodically re-enable as a safety net (every 30 seconds)
    const interval = setInterval(enable, 30_000);

    return () => {
      document.removeEventListener('touchstart', enable);
      document.removeEventListener('click', enable);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
      noSleep.disable();
      noSleepRef.current = null;
    };
  }, []);
}
