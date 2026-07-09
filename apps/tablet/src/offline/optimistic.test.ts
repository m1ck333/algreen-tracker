import { describe, it, expect } from 'vitest';
import { SubProcessStatus } from '@alblue/shared-types';
import type { ProcessGroupDto, TabletActiveWorkDto } from '@alblue/shared-types';
import {
  applySubProcessTransition,
  freezeProcessTimer,
  resumeProcessTimer,
  removeProcessFromActive,
} from './optimistic';

const NOW = '2026-06-29T10:00:00.000Z';

function groups(): ProcessGroupDto<TabletActiveWorkDto>[] {
  return [
    {
      processId: 'proc', processCode: 'P', processName: 'Proc', sequenceOrder: 1,
      items: [
        {
          orderItemProcessId: 'oip1', orderId: 'o1', orderItemId: 'i1', orderNumber: '1',
          priority: 0, deliveryDate: NOW, productName: 'X', productCategoryName: null,
          quantity: 1, complexity: null, status: 'InProgress' as TabletActiveWorkDto['status'],
          specialRequestNames: [], completedProcessCount: 0, totalProcessCount: 1,
          startedAt: NOW, totalDurationMinutes: 0, isTimerRunning: false, currentLogStartedAt: null,
          orderNotes: null, itemNotes: null, attachmentCount: 0,
          subProcesses: [
            { id: 's1', subProcessId: 'sp1', status: SubProcessStatus.Pending, totalDurationMinutes: 0, isWithdrawn: false, isTimerRunning: false, currentLogStartedAt: null },
            { id: 's2', subProcessId: 'sp2', status: SubProcessStatus.Pending, totalDurationMinutes: 0, isWithdrawn: false, isTimerRunning: false, currentLogStartedAt: null },
          ],
        },
      ],
    },
  ];
}

describe('applySubProcessTransition', () => {
  it("start: flips the target sub to InProgress + running, and starts the process timer", () => {
    const result = applySubProcessTransition(groups(), 's1', 'start', NOW)!;
    const item = result[0].items[0];
    const s1 = item.subProcesses.find((s) => s.id === 's1')!;
    expect(s1.status).toBe(SubProcessStatus.InProgress);
    expect(s1.isTimerRunning).toBe(true);
    expect(s1.currentLogStartedAt).toBe(NOW);
    expect(item.isTimerRunning).toBe(true);
    expect(item.currentLogStartedAt).toBe(NOW);
  });

  it('complete: flips the target sub to Completed and stops the timer', () => {
    const result = applySubProcessTransition(groups(), 's1', 'complete', NOW)!;
    const item = result[0].items[0];
    expect(item.subProcesses.find((s) => s.id === 's1')!.status).toBe(SubProcessStatus.Completed);
    expect(item.isTimerRunning).toBe(false);
  });

  it('leaves sibling sub-processes untouched', () => {
    const result = applySubProcessTransition(groups(), 's1', 'start', NOW)!;
    expect(result[0].items[0].subProcesses.find((s) => s.id === 's2')!.status).toBe(SubProcessStatus.Pending);
  });

  it('does not mutate the input (returns a new structure)', () => {
    const input = groups();
    const result = applySubProcessTransition(input, 's1', 'start', NOW)!;
    expect(result).not.toBe(input);
    expect(input[0].items[0].subProcesses[0].status).toBe(SubProcessStatus.Pending); // original intact
  });

  it('returns undefined groups unchanged', () => {
    expect(applySubProcessTransition(undefined, 's1', 'start', NOW)).toBeUndefined();
  });
});

describe('freezeProcessTimer', () => {
  it('stops the timer and freezes elapsed at accumulated + running session', () => {
    const g = groups();
    g[0].items[0].totalDurationMinutes = 100; // seconds (legacy name)
    g[0].items[0].isTimerRunning = true;
    g[0].items[0].currentLogStartedAt = '2026-06-29T10:00:00.000Z';
    const nowMs = new Date('2026-06-29T10:00:30.000Z').getTime(); // +30s session

    const item = freezeProcessTimer(g, 'oip1', nowMs)![0].items[0];
    expect(item.isTimerRunning).toBe(false);
    expect(item.currentLogStartedAt).toBeNull();
    expect(item.totalDurationMinutes).toBe(130); // 100 + 30
  });

  it('leaves a non-targeted process untouched', () => {
    const item = freezeProcessTimer(groups(), 'other-oip', Date.parse(NOW))![0].items[0];
    expect(item.orderItemProcessId).toBe('oip1');
  });
});

describe('resumeProcessTimer', () => {
  it('restarts the timer from now', () => {
    const item = resumeProcessTimer(groups(), 'oip1', NOW)![0].items[0];
    expect(item.isTimerRunning).toBe(true);
    expect(item.currentLogStartedAt).toBe(NOW);
  });
});

describe('removeProcessFromActive', () => {
  it('drops the completed process and prunes the now-empty group', () => {
    expect(removeProcessFromActive(groups(), 'oip1')).toEqual([]);
  });

  it('keeps other items in the group', () => {
    const g = groups();
    g[0].items.push({ ...g[0].items[0], orderItemProcessId: 'oip2' });
    const result = removeProcessFromActive(g, 'oip1')!;
    expect(result[0].items.map((i) => i.orderItemProcessId)).toEqual(['oip2']);
  });
});
