import dayjs from 'dayjs';
import { OrderStatus, ProcessStatus } from '@alblue/shared-types';
import type { OrderDetailDto } from '@alblue/shared-types';

// ─── Process status color mapping (matching Excel conditional formatting) ────

export const processStatusColors: Record<ProcessStatus, string> = {
  [ProcessStatus.Completed]: '#92D050',   // Green - done
  [ProcessStatus.InProgress]: '#1890ff',  // Blue - in progress
  [ProcessStatus.Blocked]: '#FF0000',     // Red - blocked
  [ProcessStatus.Stopped]: '#FFAA00',     // Orange - stopped
  [ProcessStatus.Pending]: '#BFBFBF',     // Medium gray - pending (darker than empty/not-applicable)
  [ProcessStatus.Withdrawn]: '#F0F0F0',   // Very light gray - withdrawn
};

// Bold border for "ready to start" — fixed vivid green, distinct from Completed
// bright green and clearly visible against any cell fill in both light/dark themes.
export const READY_BORDER_COLOR = '#1B5E20';

// Color maps for the 4 original seeded order type codes. Custom codes
// (admin-added since 20.06.2026) fall back to neutral defaults so they
// render without crashing. Admins can theme custom types via the
// OrderTypes admin page in a future iteration.
export const orderTypeColors: Record<string, string> = {
  Standard: 'blue',
  Repair: 'orange',
  Complaint: 'red',
  Rework: 'purple',
};

export const orderTypeTextColors: Record<string, string> = {
  Standard: '#1677ff',
  Repair: '#d46b08',
  Complaint: '#cf1322',
  Rework: '#531dab',
};

export const orderStatusTextColors: Record<OrderStatus, string> = {
  [OrderStatus.Draft]: '#8c8c8c',
  [OrderStatus.Active]: '#389e0d',
  [OrderStatus.Paused]: '#d46b08',
  [OrderStatus.Cancelled]: '#cf1322',
  [OrderStatus.Completed]: '#08979c',
};

// ─── Helpers ─────────────────────────────────────────────

/** Aggregate process status across all items in an order for a given processId (used in detail drawer) */
export type AggregateState = {
  status: ProcessStatus | null;
  isReady: boolean;  // pending-ready or paused (gray + bold border)
  isPaused: boolean; // subset of isReady - show "Pauzirano" text
};

/**
 * Sourced directly from the master-view row (BE-computed):
 *   - processStatuses[processId] — aggregated status string
 *   - processReady[processId]    — true if any item has it Pending + deps satisfied
 *   - processPaused[processId]   — true if any item has it paused
 *
 * Previously this was recomputed on the FE from a flattened processDependencies
 * dict, which was wrong for multi-item orders with different categories: deps
 * from item A's category were applied to item B and vice-versa, giving false
 * negatives/positives. The BE already does the right per-item computation —
 * just consume it.
 */
export type MasterRowFields = {
  processStatuses?: Record<string, string>;
  processReady?: Record<string, boolean>;
  processPaused?: Record<string, boolean>;
};

export function getAggregateProcessState(
  masterRow: MasterRowFields | undefined,
  processId: string,
): AggregateState {
  if (!masterRow?.processStatuses || !(processId in masterRow.processStatuses)) {
    return { status: null, isReady: false, isPaused: false };
  }
  const status = masterRow.processStatuses[processId] as ProcessStatus;
  const isPausedAgg = masterRow.processPaused?.[processId] ?? false;
  const isReady = masterRow.processReady?.[processId] ?? false;
  // BE already enforces the priority (Blocked/InProgress beat Ready), so we
  // just forward what it says — the only twist is when paused, the bold ring
  // is replaced with the orange "paused" visual.
  return { status, isReady, isPaused: isPausedAgg };
}

/** Count completed vs total processes across all items (used in detail drawer) */
export function getCompletionInfo(order: OrderDetailDto): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const item of order.items) {
    for (const proc of item.processes) {
      if (proc.status !== ProcessStatus.Withdrawn) {
        total++;
        if (proc.status === ProcessStatus.Completed) completed++;
      }
    }
  }
  return { completed, total };
}

/** Get deadline urgency level based on delivery date */
export function getDeadlineLevel(
  deliveryDate: string,
  customWarningDays: number | null,
  customCriticalDays: number | null,
): 'critical' | 'warning' | 'normal' {
  const daysRemaining = dayjs(deliveryDate).diff(dayjs(), 'day');
  const criticalDays = customCriticalDays ?? 3;
  const warningDays = customWarningDays ?? 7;
  if (daysRemaining <= criticalDays) return 'critical';
  if (daysRemaining <= warningDays) return 'warning';
  return 'normal';
}

export function statusColor(status: string | null, paused: boolean): string {
  if (paused) return '#faad14';
  if (!status) return '#999';
  return processStatusColors[status as ProcessStatus] ?? '#999';
}

export function formatDurationSec(totalSec: number): string {
  if (totalSec <= 0) return '';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  return `${m}min ${s}s`;
}

export function calcLiveSeconds(proc: { status: string; totalDurationMinutes: number; startedAt: string | null; pausedAt: string | null; resumedAt: string | null; subProcesses?: { totalDurationMinutes: number; status: string; isWithdrawn: boolean; isTimerRunning?: boolean; currentLogStartedAt?: string | null }[] }): number {
  // For processes with sub-processes, sum sub-process durations + open log elapsed
  if (proc.subProcesses && proc.subProcesses.length > 0) {
    const result = proc.subProcesses
      .filter((sp) => !sp.isWithdrawn)
      .reduce((sum, sp) => {
        let spTime = sp.totalDurationMinutes;
        if (sp.isTimerRunning && sp.currentLogStartedAt) {
          spTime += Math.max(0, Math.floor((Date.now() - new Date(sp.currentLogStartedAt).getTime()) / 1000));
        }
        return sum + spTime;
      }, 0);
    return result;
  }
  const saved = proc.totalDurationMinutes;
  if (proc.status === 'InProgress' && !proc.pausedAt && (proc.startedAt || proc.resumedAt)) {
    const since = proc.resumedAt ?? proc.startedAt!;
    const elapsed = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
    return saved + Math.max(elapsed, 0);
  }
  return saved;
}

export function isPaused(proc: {
  status: string;
  pausedAt: string | null;
  subProcesses?: { status: string; isWithdrawn: boolean; isTimerRunning?: boolean }[];
}): boolean {
  if (proc.status !== 'InProgress') return false;
  if (proc.subProcesses && proc.subProcesses.length > 0) {
    const active = proc.subProcesses.filter((sp) => !sp.isWithdrawn);
    const anyTimerRunning = active.some((sp) => sp.isTimerRunning);
    const allDone = active.every((sp) => sp.status === 'Completed');
    return !anyTimerRunning && !allDone;
  }
  return !!proc.pausedAt;
}
