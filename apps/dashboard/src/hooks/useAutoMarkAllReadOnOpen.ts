import { useEffect, useRef } from 'react';

/**
 * Auto-mark-all-read `delayMs` after `open` becomes true, but only if there is
 * something unread at fire time. Used by the sidebar bell popover: nobody taps
 * the explicit "Mark all read", so the unread badge grows meaningless.
 *
 * Keyed on `open` ONLY — the unread count and the mark callback are read via
 * refs, so a notification arriving while the popover is open does NOT restart
 * the timer (which would defer the mark indefinitely — the exact restart bug
 * this guards against). Closing (or unmounting) before the delay cancels it.
 */
export function useAutoMarkAllReadOnOpen(
  open: boolean,
  unreadCount: number | undefined,
  markAllRead: () => void,
  delayMs = 800,
): void {
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if ((unreadCountRef.current ?? 0) > 0) markAllReadRef.current();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [open, delayMs]);
}
