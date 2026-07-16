import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoMarkAllReadOnce } from './useAutoMarkAllReadOnce';

describe('useAutoMarkAllReadOnce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks all read once, 800ms after becoming ready', () => {
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ ready }) => useAutoMarkAllReadOnce(ready, markAllRead),
      { initialProps: { ready: false } },
    );

    // Not ready yet (still loading / no unread) → nothing scheduled.
    vi.advanceTimersByTime(2000);
    expect(markAllRead).not.toHaveBeenCalled();

    // Becomes ready → fires exactly once, only after the full delay.
    rerender({ ready: true });
    vi.advanceTimersByTime(799);
    expect(markAllRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('fires only once per mount even if ready toggles afterwards', () => {
    // A notification arriving while the page is open flips hasUnread around;
    // the ref guard must keep the mark a single-shot per visit.
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ ready }) => useAutoMarkAllReadOnce(ready, markAllRead),
      { initialProps: { ready: true } },
    );

    vi.advanceTimersByTime(800);
    expect(markAllRead).toHaveBeenCalledTimes(1);

    rerender({ ready: false });
    rerender({ ready: true });
    vi.advanceTimersByTime(2000);
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending mark if unmounted before the delay', () => {
    const markAllRead = vi.fn();
    const { unmount } = renderHook(() => useAutoMarkAllReadOnce(true, markAllRead));

    vi.advanceTimersByTime(400);
    unmount(); // worker navigates away before the 800ms elapses
    vi.advanceTimersByTime(1000);
    expect(markAllRead).not.toHaveBeenCalled();
  });
});
