import { SubProcessStatus } from '@alblue/shared-types';
import type { ProcessGroupDto, TabletActiveWorkDto } from '@alblue/shared-types';

export type SubTransition = 'start' | 'complete';
export type ActiveGroups = ProcessGroupDto<TabletActiveWorkDto>[];

// Elapsed seconds frozen at `nowMs`: accumulated total plus the running session.
function frozenSeconds(
  totalDurationMinutes: number,
  isTimerRunning: boolean,
  currentLogStartedAt: string | null,
  nowMs: number,
): number {
  if (isTimerRunning && currentLogStartedAt) {
    const session = Math.floor((nowMs - new Date(currentLogStartedAt).getTime()) / 1000);
    return totalDurationMinutes + Math.max(session, 0);
  }
  return totalDurationMinutes;
}

/**
 * Optimistically stop a process's timer in place (a paused process). Freezes the
 * elapsed value so the counter holds steady instead of ticking, and stops any
 * running sub-process timer. Contained to the active view.
 */
export function freezeProcessTimer(
  groups: ActiveGroups | undefined,
  orderItemProcessId: string,
  nowMs: number,
): ActiveGroups | undefined {
  if (!groups) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.orderItemProcessId !== orderItemProcessId) return item;
      return {
        ...item,
        totalDurationMinutes: frozenSeconds(item.totalDurationMinutes, item.isTimerRunning, item.currentLogStartedAt, nowMs),
        isTimerRunning: false,
        currentLogStartedAt: null,
        subProcesses: item.subProcesses.map((sp) =>
          sp.isTimerRunning
            ? { ...sp, totalDurationMinutes: frozenSeconds(sp.totalDurationMinutes, sp.isTimerRunning, sp.currentLogStartedAt, nowMs), isTimerRunning: false, currentLogStartedAt: null }
            : sp,
        ),
      };
    }),
  }));
}

/** Optimistically restart a paused process's timer (resume). */
export function resumeProcessTimer(
  groups: ActiveGroups | undefined,
  orderItemProcessId: string,
  nowIso: string,
): ActiveGroups | undefined {
  if (!groups) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.orderItemProcessId !== orderItemProcessId
        ? item
        : { ...item, isTimerRunning: true, currentLogStartedAt: nowIso },
    ),
  }));
}

/** Optimistically drop a just-completed process from the active list. */
export function removeProcessFromActive(
  groups: ActiveGroups | undefined,
  orderItemProcessId: string,
): ActiveGroups | undefined {
  if (!groups) return groups;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((i) => i.orderItemProcessId !== orderItemProcessId) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Returns a copy of the tablet-active groups with one sub-process moved to its
 * post-action state, for optimistic rendering while a queued (offline) or
 * in-flight action settles. Pure — no cache/DOM side effects.
 *
 * Scope is deliberately contained to the active view's sub-process the worker
 * tapped (plus the process-level timer so the elapsed counter starts/stops).
 * Cross-list moves (an item leaving the queue/active list) are NOT done
 * optimistically — the refetch on reconnect reconciles those with server truth.
 */
export function applySubProcessTransition(
  groups: ActiveGroups | undefined,
  subProcessId: string,
  transition: SubTransition,
  nowIso: string,
): ActiveGroups | undefined {
  if (!groups) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (!item.subProcesses.some((sp) => sp.id === subProcessId)) return item;

      const subProcesses = item.subProcesses.map((sp) => {
        if (sp.id !== subProcessId) return sp;
        return transition === 'start'
          ? { ...sp, status: SubProcessStatus.InProgress, isTimerRunning: true, currentLogStartedAt: nowIso }
          : { ...sp, status: SubProcessStatus.Completed, isTimerRunning: false };
      });

      return {
        ...item,
        subProcesses,
        // Mirror the process-level timer so the elapsed counter reflects the tap.
        isTimerRunning: transition === 'start',
        currentLogStartedAt: transition === 'start' ? nowIso : item.currentLogStartedAt,
      };
    }),
  }));
}
