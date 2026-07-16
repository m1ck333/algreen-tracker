import { useEffect, useRef } from 'react';

/**
 * Fire `markAllRead` once, `delayMs` after `ready` first becomes true, then
 * never again for this mount (ref-guarded). Used on the tablet notifications
 * page: mark everything read shortly after the worker opens it, so the unread
 * badge doesn't grow meaningless. Unlike the dashboard bell, this fires a
 * SINGLE time per visit — a notification arriving while the page is open does
 * not re-arm it. Unmounting before the delay cancels the pending mark.
 */
export function useAutoMarkAllReadOnce(
  ready: boolean,
  markAllRead: () => void,
  delayMs = 800,
): void {
  const firedRef = useRef(false);
  const timerRef = useRef<number>();
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;

  useEffect(() => {
    if (firedRef.current || !ready) return;
    firedRef.current = true;
    timerRef.current = window.setTimeout(() => markAllReadRef.current(), delayMs);
  }, [ready, delayMs]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );
}
