import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoMarkAllReadOnOpen } from './useAutoMarkAllReadOnOpen';

describe('useAutoMarkAllReadOnOpen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks all read once, 800ms after the popover opens with unread', () => {
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ open, count }) => useAutoMarkAllReadOnOpen(open, count, markAllRead),
      { initialProps: { open: false, count: 5 } },
    );

    // Closed → nothing scheduled.
    vi.advanceTimersByTime(2000);
    expect(markAllRead).not.toHaveBeenCalled();

    // Open → fires exactly once, only after the full delay.
    rerender({ open: true, count: 5 });
    vi.advanceTimersByTime(799);
    expect(markAllRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('does not mark when there is nothing unread at fire time', () => {
    const markAllRead = vi.fn();
    renderHook(() => useAutoMarkAllReadOnOpen(true, 0, markAllRead));
    vi.advanceTimersByTime(1000);
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('does NOT restart the timer when the unread count changes while open', () => {
    // The bug this guards: a notification arriving mid-wait used to re-run the
    // effect and reset the 800ms timer, deferring the mark indefinitely. The
    // count is read via a ref, so updating it must not re-arm the timer.
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ count }) => useAutoMarkAllReadOnOpen(true, count, markAllRead),
      { initialProps: { count: 3 } },
    );

    vi.advanceTimersByTime(500); // half-way through the original timer
    rerender({ count: 4 });      // a new notification arrives
    vi.advanceTimersByTime(300); // reaches the ORIGINAL 800ms deadline
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending mark if the popover closes before the delay', () => {
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useAutoMarkAllReadOnOpen(open, 5, markAllRead),
      { initialProps: { open: true } },
    );

    vi.advanceTimersByTime(400);
    rerender({ open: false }); // quick open/close (e.g. accidental click)
    vi.advanceTimersByTime(1000);
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('reads the latest count at fire time, not the count when it opened', () => {
    // Opened with 0 unread, one arrives before the delay → should still fire.
    const markAllRead = vi.fn();
    const { rerender } = renderHook(
      ({ count }) => useAutoMarkAllReadOnOpen(true, count, markAllRead),
      { initialProps: { count: 0 } },
    );

    vi.advanceTimersByTime(400);
    rerender({ count: 2 });
    vi.advanceTimersByTime(400);
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });
});
