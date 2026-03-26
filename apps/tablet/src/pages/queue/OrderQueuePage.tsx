import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { tabletApi, processWorkflowApi, subProcessWorkflowApi, processesApi, blockRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { ProcessStatus, SubProcessStatus } from '@algreen/shared-types';
import { useSignalREvent, SignalREvents } from '@algreen/signalr-client';
import type { TabletQueueItemDto, TabletActiveWorkDto, TabletSubProcessDto } from '@algreen/shared-types';
import { BigButton } from '../../components/BigButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AttachmentViewer } from '../../components/AttachmentViewer';
import { AttachmentIndicator } from '../../components/AttachmentIndicator';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}min ${seconds}s` : `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getApiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function getTranslatedError(error: unknown, t: (key: string, opts?: Record<string, string>) => string, fallback: string): string {
  const code = getApiErrorCode(error);
  if (code) {
    const translated = t(`common:errors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return fallback;
}

export function OrderQueuePage() {
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();
  const location = useLocation();
  const highlightId = (location.state as { highlightId?: string } | null)?.highlightId;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const queryClient = useQueryClient();

  const { data: queueGroups, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tablet-queue', userId, tenantId],
    queryFn: () => tabletApi.getQueue(userId!, tenantId!).then((r) => r.data),
    enabled: !!tenantId && !!userId,
    refetchInterval: 60_000,
  });

  useSignalREvent(SignalREvents.ProcessUnblocked, () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
  });

  const { data: activeGroups } = useQuery({
    queryKey: ['tablet-active', userId, tenantId],
    queryFn: () => tabletApi.getActive(userId!, tenantId!).then((r) => r.data),
    enabled: !!userId && !!tenantId,
    refetchInterval: 120_000,
  });

  // Fetch process definitions for all assigned processes to get sub-process names
  const allProcessIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of queueGroups ?? []) ids.add(g.processId);
    for (const g of activeGroups ?? []) ids.add(g.processId);
    return Array.from(ids);
  }, [queueGroups, activeGroups]);

  const { data: processDefinitions } = useQuery({
    queryKey: ['processes-batch', ...allProcessIds],
    queryFn: () => Promise.all(allProcessIds.map((id) => processesApi.getById(id).then((r) => r.data))),
    enabled: allProcessIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const subProcessNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (processDefinitions) {
      for (const pd of processDefinitions) {
        if (pd?.subProcesses) {
          for (const sp of pd.subProcesses) {
            map.set(sp.id, sp.name);
          }
        }
      }
    }
    return map;
  }, [processDefinitions]);

  const subProcessOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    if (processDefinitions) {
      for (const pd of processDefinitions) {
        if (pd?.subProcesses) {
          for (const sp of pd.subProcesses) {
            map.set(sp.id, sp.sequenceOrder);
          }
        }
      }
    }
    return map;
  }, [processDefinitions]);

  // Build a map from orderItemProcessId → processCode/processName
  const processInfoMap = useMemo(() => {
    const map = new Map<string, { processCode: string; processName: string }>();
    for (const g of queueGroups ?? []) {
      for (const item of g.items) {
        map.set(item.orderItemProcessId, { processCode: g.processCode, processName: g.processName });
      }
    }
    for (const g of activeGroups ?? []) {
      for (const item of g.items) {
        if (!map.has(item.orderItemProcessId)) {
          map.set(item.orderItemProcessId, { processCode: g.processCode, processName: g.processName });
        }
      }
    }
    return map;
  }, [queueGroups, activeGroups]);

  // Flatten all groups into a single active work map
  const activeWorkMap = useMemo(() => {
    const map = new Map<string, TabletActiveWorkDto>();
    for (const g of activeGroups ?? []) {
      for (const w of g.items) {
        map.set(w.orderItemProcessId, w);
      }
    }
    return map;
  }, [activeGroups]);

  // Merge all queue groups + active items into a single flat list
  const mergedItems = useMemo(() => {
    const items: TabletQueueItemDto[] = [];
    const seen = new Set<string>();
    for (const g of queueGroups ?? []) {
      for (const item of g.items) {
        if (!seen.has(item.orderItemProcessId)) {
          items.push(item);
          seen.add(item.orderItemProcessId);
        }
      }
    }
    for (const g of activeGroups ?? []) {
      for (const w of g.items) {
        if (!seen.has(w.orderItemProcessId)) {
          items.push({
            orderItemProcessId: w.orderItemProcessId,
            orderId: w.orderId,
            orderItemId: w.orderItemId,
            orderNumber: w.orderNumber,
            priority: w.priority,
            deliveryDate: w.deliveryDate,
            productName: w.productName,
            productCategoryName: w.productCategoryName,
            quantity: w.quantity,
            complexity: w.complexity,
            status: w.status,
            specialRequestNames: w.specialRequestNames,
            completedProcessCount: w.completedProcessCount,
            totalProcessCount: w.totalProcessCount,
            totalDurationMinutes: w.totalDurationMinutes ?? 0,
          });
          seen.add(w.orderItemProcessId);
        }
      }
    }
    return items.sort((a, b) => {
      const aInProgress = a.status === ProcessStatus.InProgress ? 0 : 1;
      const bInProgress = b.status === ProcessStatus.InProgress ? 0 : 1;
      if (aInProgress !== bInProgress) return aInProgress - bInProgress;
      return a.priority - b.priority;
    });
  }, [queueGroups, activeGroups]);

  // Auto-expand and highlight item from notification (run once)
  const highlightHandled = useRef(false);
  useEffect(() => {
    if (highlightId && mergedItems.length && !highlightHandled.current) {
      const idx = mergedItems.findIndex(
        (i) => i.orderId === highlightId || i.orderItemProcessId === highlightId,
      );
      if (idx >= 0) {
        highlightHandled.current = true;
        if (idx >= visibleCount) {
          setVisibleCount(idx + 1);
        }
        setExpandedItemId(mergedItems[idx].orderItemProcessId);
        setHighlightedId(mergedItems[idx].orderItemProcessId);
        const timer = setTimeout(() => setHighlightedId(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightId, mergedItems]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <span className="inline-block w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <span className="text-tablet-sm text-gray-400">{t('queue.loadingQueue')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-tablet-base text-red-600">{t('queue.loadFailed')}</p>
        <button
          onClick={() => refetch()}
          className="bg-primary-500 text-white px-6 py-3 rounded-xl text-tablet-sm font-semibold"
        >
          {t('queue.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-tablet-xl font-bold">{t('queue.title')}</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg text-gray-500 active:bg-gray-100 disabled:opacity-50"
        >
          <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={isFetching ? 'animate-spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <p className="text-gray-500 text-tablet-sm">
        {mergedItems.length === 1
          ? t('queue.activeOrder', { count: mergedItems.length })
          : t('queue.activeOrders', { count: mergedItems.length })}
      </p>

      {mergedItems.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-tablet-base">
          {t('queue.noOrders')}
        </div>
      ) : (
        <div className="space-y-3">
          {mergedItems.slice(0, visibleCount).map((item) => (
            <QueueCard
              key={item.orderItemProcessId}
              item={item}
              processInfo={processInfoMap.get(item.orderItemProcessId)}
              isExpanded={expandedItemId === item.orderItemProcessId}
              isHighlighted={highlightedId === item.orderItemProcessId}
              onToggle={() =>
                setExpandedItemId(
                  expandedItemId === item.orderItemProcessId ? null : item.orderItemProcessId,
                )
              }
              activeWork={activeWorkMap.get(item.orderItemProcessId)}
              subProcessNameMap={subProcessNameMap}
              subProcessOrderMap={subProcessOrderMap}
              userId={userId!}
              tenantId={tenantId!}
              t={t}
              tEnum={tEnum}
            />
          ))}
          {mergedItems.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              className="w-full py-3 text-center text-tablet-sm font-semibold text-primary-500 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
            >
              {t('tablet:common.loadMore', { remaining: mergedItems.length - visibleCount })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QueueCard({
  item,
  processInfo,
  isExpanded,
  isHighlighted,
  onToggle,
  activeWork,
  subProcessNameMap,
  subProcessOrderMap,
  userId,
  tenantId,
  t,
  tEnum,
}: {
  item: TabletQueueItemDto;
  processInfo?: { processCode: string; processName: string };
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
  activeWork?: TabletActiveWorkDto;
  subProcessNameMap: Map<string, string>;
  subProcessOrderMap: Map<string, number>;
  userId: string;
  tenantId: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  tEnum: (enumName: string, value: string) => string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const daysUntilDelivery = Math.ceil(
    (new Date(item.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const isBlocked = item.status === ProcessStatus.Blocked;
  const isInProgress = item.status === ProcessStatus.InProgress;
  const isPaused = isInProgress && activeWork != null && !activeWork.isTimerRunning;

  const cardColor = isInProgress
    ? 'bg-amber-50 border-l-4 border-amber-400'
    : 'bg-white border-gray-200';
  const daysColor = daysUntilDelivery <= 3
    ? 'text-red-600 font-bold'
    : daysUntilDelivery <= 5
      ? 'text-yellow-600 font-semibold'
      : '';

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  return (
    <div ref={cardRef} className={`card border-2 ${cardColor} ${isExpanded ? 'ring-2 ring-primary-300' : ''} ${isHighlighted ? 'animate-highlight-glow' : ''}`}>
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-tablet-lg font-bold">{item.orderNumber}</span>
            {processInfo && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
                {processInfo.processCode} — {processInfo.processName}
              </span>
            )}
            {isBlocked && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
                {tEnum('ProcessStatus', ProcessStatus.Blocked)}
              </span>
            )}
            {isInProgress && activeWork?.isTimerRunning && (
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
                {t('work.working')}
              </span>
            )}
            {isPaused && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
                {t('work.paused')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-tablet-sm font-medium">
              P{item.priority}
            </span>
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div className="flex items-center justify-between text-tablet-sm text-gray-600">
          <span>
            {item.productCategoryName && (
              <span className="inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-tablet-xs font-medium mr-1.5">{item.productCategoryName}</span>
            )}
            {item.productName}
          </span>
          <span>{t('queue.qty', { count: item.quantity })}</span>
          {item.complexity && <span>{tEnum('ComplexityType', item.complexity)}</span>}
          <span className={daysColor}>
            {t('queue.daysLeft', { count: daysUntilDelivery })}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-tablet-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">
              {t('queue.progress', { completed: item.completedProcessCount, total: item.totalProcessCount })}
            </span>
            {item.totalDurationMinutes > 0 && !activeWork && (
              <span className="text-gray-500">⏱ {formatDuration(item.totalDurationMinutes)}</span>
            )}
            <AttachmentIndicator orderId={item.orderId} orderItemId={item.orderItemId} />
          </div>
          {item.specialRequestNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.specialRequestNames.map((name) => (
                <span key={name} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-tablet-xs">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <>
          <WorkPanel
            orderItemProcessId={item.orderItemProcessId}
            activeWork={activeWork}
            savedDuration={item.totalDurationMinutes}
            subProcessNameMap={subProcessNameMap}
            subProcessOrderMap={subProcessOrderMap}
            userId={userId}
            tenantId={tenantId}
            t={t}
            tEnum={tEnum}
          />
          <AttachmentViewer orderId={item.orderId} orderItemId={item.orderItemId} />
        </>
      )}
    </div>
  );
}

function WorkPanel({
  orderItemProcessId,
  activeWork,
  savedDuration,
  subProcessNameMap,
  subProcessOrderMap,
  userId,
  tenantId,
  t,
  tEnum,
}: {
  orderItemProcessId: string;
  activeWork?: TabletActiveWorkDto;
  savedDuration?: number;
  subProcessNameMap: Map<string, string>;
  subProcessOrderMap: Map<string, number>;
  userId: string;
  tenantId: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  tEnum: (enumName: string, value: string) => string;
}) {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [activeMutationId, setActiveMutationId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  const isWorking = activeWork?.status === ProcessStatus.InProgress;
  const isTimerRunning = activeWork?.isTimerRunning ?? false;
  const isPaused = isWorking && !isTimerRunning;
  const hasSubProcesses = (activeWork?.subProcesses?.length ?? 0) > 0;

  // Check if all sub-processes are completed/withdrawn (ready for process completion)
  const allSubsDone = activeWork?.subProcesses?.every(
    (sp) => sp.status === SubProcessStatus.Completed || sp.isWithdrawn,
  ) ?? false;

  // Compute elapsed = accumulated duration + current session time
  const elapsed = useMemo(() => {
    if (!activeWork) return savedDuration ?? 0;
    const prior = activeWork.totalDurationMinutes ?? 0;
    if (isTimerRunning && activeWork.currentLogStartedAt) {
      const sinceLogStart = Math.floor((Date.now() - new Date(activeWork.currentLogStartedAt).getTime()) / 1000);
      return prior + Math.max(sinceLogStart, 0);
    }
    return prior;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWork?.totalDurationMinutes, activeWork?.currentLogStartedAt, isTimerRunning, tick]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleError = (err: unknown, fallbackKey: string) => {
    setError(getTranslatedError(err, t as (key: string, opts?: Record<string, string>) => string, t(fallbackKey)));
  };

  const invalidateAndWait = async (keys: string[]) => {
    setPendingAction(true);
    await Promise.all(
      keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    );
    await Promise.all(
      keys.map((k) => queryClient.refetchQueries({ queryKey: [k] })),
    );
    setPendingAction(false);
  };

  const startMutation = useMutation({
    mutationFn: () => processWorkflowApi.start(orderItemProcessId, { userId }),
    onSuccess: async () => {
      setError(null);
      await invalidateAndWait(['tablet-active', 'tablet-queue', 'tablet-incoming']);
    },
    onError: (err) => handleError(err, 'work.startFailed'),
  });

  const pauseMutation = useMutation({
    mutationFn: () => processWorkflowApi.stop(orderItemProcessId, { userId }),
    onSuccess: async () => {
      setError(null);
      await invalidateAndWait(['tablet-active', 'tablet-queue', 'tablet-incoming']);
    },
    onError: (err) => handleError(err, 'work.pauseFailed'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => processWorkflowApi.resume(orderItemProcessId, { userId }),
    onSuccess: async () => {
      setError(null);
      await invalidateAndWait(['tablet-active', 'tablet-queue', 'tablet-incoming']);
    },
    onError: (err) => handleError(err, 'work.resumeFailed'),
  });

  const completeMutation = useMutation({
    mutationFn: () => processWorkflowApi.complete(orderItemProcessId),
    onSuccess: async () => {
      setError(null);
      setShowCompleteConfirm(false);
      await invalidateAndWait(['tablet-active', 'tablet-queue', 'tablet-incoming']);
    },
    onError: (err) => {
      setShowCompleteConfirm(false);
      handleError(err, 'work.completeFailed');
    },
  });

  const startSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.start(id, { userId }),
    onSuccess: async () => { setError(null); setActiveMutationId(null); await invalidateAndWait(['tablet-active']); },
    onError: (err) => { setActiveMutationId(null); handleError(err, 'work.startFailed'); },
  });

  const completeSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.complete(id, { userId }),
    onSuccess: async () => { setError(null); setActiveMutationId(null); await invalidateAndWait(['tablet-active']); },
    onError: (err) => { setActiveMutationId(null); handleError(err, 'work.completeFailed'); },
  });

  const blockMutation = useMutation({
    mutationFn: () =>
      blockRequestsApi.create({
        tenantId,
        orderItemProcessId,
        requestedByUserId: userId,
        requestNote: blockReason,
      }),
    onSuccess: async () => {
      setError(null);
      setShowBlockModal(false);
      setBlockReason('');
      setSuccess(t('work.blockSent'));
      setTimeout(() => setSuccess(null), 4000);
      await invalidateAndWait(['tablet-active', 'tablet-queue', 'tablet-incoming']);
    },
    onError: (err) => {
      setShowBlockModal(false);
      handleError(err, 'work.blockFailed');
    },
  });

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const daysUntilDelivery = activeWork
    ? Math.ceil((new Date(activeWork.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="border-t border-gray-200 mt-3 pt-3 space-y-4">
      {/* Order details */}
      {activeWork && (
        <div className="grid grid-cols-2 gap-2 text-tablet-xs">
          {activeWork.startedAt && (
            <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5 col-span-2">
              <span className="text-gray-500">{t('work.startedAt')}</span>
              <span className="font-semibold">
                {new Date(activeWork.startedAt).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          )}
          <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5 col-span-2">
            <span className="text-gray-500">{t('work.progress')}</span>
            <span className="font-semibold">
              {activeWork.completedProcessCount}/{activeWork.totalProcessCount}
            </span>
          </div>
        </div>
      )}

      {/* Timer */}
      <div className="text-center py-4 bg-gray-50 rounded-xl">
        <div className="text-4xl font-mono font-bold text-primary-500">
          {formatTime(elapsed)}
        </div>
        <p className="text-gray-500 mt-1 text-tablet-xs">
          {isTimerRunning ? t('work.working') : isPaused ? t('work.paused') : t('work.readyToStart')}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-tablet-sm">
          {error}
        </div>
      )}
      {/* Success message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-tablet-sm">
          {success}
        </div>
      )}

      {/* Sub-processes */}
      {activeWork?.subProcesses && activeWork.subProcesses.length > 0 && (
        <div>
          <h3 className="text-tablet-sm font-semibold mb-2">{t('work.subProcesses')}</h3>
          <div className="space-y-2">
            {(() => {
              const sorted = [...activeWork.subProcesses].sort((a, b) => (subProcessOrderMap.get(a.subProcessId) ?? 0) - (subProcessOrderMap.get(b.subProcessId) ?? 0));
              const hasInProgress = sorted.some((s) => s.status === SubProcessStatus.InProgress);
              return sorted.map((sp, spIdx) => {
              // Can start only if: Pending, no other InProgress, and previous sub-process is completed (or it's the first)
              const prevCompleted = spIdx === 0 || sorted[spIdx - 1].status === SubProcessStatus.Completed || sorted[spIdx - 1].isWithdrawn;
              const canStart = sp.status === SubProcessStatus.Pending && !hasInProgress && prevCompleted;
              return (
                <SubProcessRow
                  key={sp.id}
                  subProcess={sp}
                  name={subProcessNameMap.get(sp.subProcessId)}
                  isLoading={activeMutationId === sp.id}
                  canStart={canStart}
                  onStart={() => { setActiveMutationId(sp.id); startSubMutation.mutate(sp.id); }}
                  onComplete={() => { setActiveMutationId(sp.id); completeSubMutation.mutate(sp.id); }}
                  tEnum={tEnum}
                  t={t}
                />
              );
            }); })()}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {!isWorking ? (
          <BigButton
            onClick={() => { setError(null); startMutation.mutate(); }}
            loading={startMutation.isPending || pendingAction}
          >
            {t('work.start')}
          </BigButton>
        ) : (
          <>
            {isTimerRunning ? (
              <BigButton
                variant="danger"
                onClick={() => { setError(null); pauseMutation.mutate(); }}
                loading={pauseMutation.isPending || pendingAction}
              >
                {t('work.pause')}
              </BigButton>
            ) : (!hasSubProcesses || activeWork?.subProcesses?.some(sp => sp.status === SubProcessStatus.InProgress)) ? (
              <BigButton
                onClick={() => { setError(null); resumeMutation.mutate(); }}
                loading={resumeMutation.isPending || pendingAction}
              >
                {t('work.resume')}
              </BigButton>
            ) : null}
            {(!hasSubProcesses || allSubsDone) && (
              <BigButton
                onClick={() => { setError(null); setShowCompleteConfirm(true); }}
                loading={completeMutation.isPending || pendingAction}
              >
                {t('work.complete')}
              </BigButton>
            )}
          </>
        )}

        <BigButton
          variant="secondary"
          onClick={() => setShowBlockModal(true)}
        >
          {t('work.reportIssue')}
        </BigButton>
      </div>

      {/* Complete confirmation dialog */}
      <ConfirmDialog
        open={showCompleteConfirm}
        title={t('work.confirmCompleteTitle')}
        message={t('work.confirmCompleteMessage')}
        confirmLabel={t('work.complete')}
        cancelLabel={t('common:actions.cancel')}
        variant="primary"
        loading={completeMutation.isPending}
        onConfirm={() => completeMutation.mutate()}
        onCancel={() => setShowCompleteConfirm(false)}
      />

      {/* Block request modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => { setShowBlockModal(false); setBlockReason(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-tablet-lg font-bold text-center">{t('work.reportIssue')}</h2>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder={t('work.blockReasonPlaceholder')}
              className="w-full border border-gray-300 rounded-xl p-3 text-tablet-sm min-h-[120px] resize-none"
            />
            <div className="space-y-3">
              <button
                onClick={() => blockMutation.mutate()}
                disabled={!blockReason.trim() || blockMutation.isPending}
                className="w-full min-h-[48px] rounded-xl text-tablet-base font-semibold bg-red-600 text-white active:bg-red-700 disabled:opacity-50"
              >
                {blockMutation.isPending ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t('work.submitBlock')
                )}
              </button>
              <button
                onClick={() => { setShowBlockModal(false); setBlockReason(''); }}
                disabled={blockMutation.isPending}
                className="w-full min-h-[48px] rounded-xl text-tablet-base font-semibold bg-gray-100 text-gray-700 active:bg-gray-200 disabled:opacity-50"
              >
                {t('common:actions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubProcessRow({
  subProcess,
  name,
  isLoading,
  canStart,
  onStart,
  onComplete,
  tEnum,
  t,
}: {
  subProcess: TabletSubProcessDto;
  name?: string;
  isLoading: boolean;
  canStart: boolean;
  onStart: () => void;
  onComplete: () => void;
  tEnum: (enumName: string, value: string) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isActive = subProcess.status === SubProcessStatus.InProgress;
  const isCompleted = subProcess.status === SubProcessStatus.Completed;
  const isWithdrawn = subProcess.isWithdrawn;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!subProcess.isTimerRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [subProcess.isTimerRunning]);

  const elapsed = useMemo(() => {
    const prior = subProcess.totalDurationMinutes ?? 0;
    if (subProcess.isTimerRunning && subProcess.currentLogStartedAt) {
      const sinceLogStart = Math.floor((Date.now() - new Date(subProcess.currentLogStartedAt).getTime()) / 1000);
      return prior + Math.max(sinceLogStart, 0);
    }
    return prior;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subProcess.totalDurationMinutes, subProcess.currentLogStartedAt, subProcess.isTimerRunning, tick]);

  if (isWithdrawn) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200 opacity-60">
        <div>
          <span className="text-tablet-sm font-medium line-through">
            {name ?? tEnum('SubProcessStatus', subProcess.status)}
          </span>
          <span className="text-tablet-xs text-red-500 ml-2">{t('work.withdrawn')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      isCompleted ? 'bg-green-50 border-green-200' :
      isActive ? 'bg-blue-50 border-blue-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div>
        <span className="text-tablet-sm font-medium">
          {name ?? tEnum('SubProcessStatus', subProcess.status)}
        </span>
        {name && (
          <span className="text-tablet-xs text-gray-500 ml-2">
            {tEnum('SubProcessStatus', subProcess.status)}
          </span>
        )}
        {(elapsed > 0 || isActive) && (
          <span className="text-tablet-xs text-gray-500 ml-2">
            {formatDuration(elapsed)}
          </span>
        )}
      </div>
      <div>
        {canStart && (
          <button
            onClick={onStart}
            disabled={isLoading}
            className="bg-primary-500 text-white px-4 py-1 rounded text-tablet-sm min-w-[70px] flex items-center justify-center"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('work.start')
            )}
          </button>
        )}
        {isActive && (
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="bg-green-500 text-white px-4 py-1 rounded text-tablet-sm min-w-[70px] flex items-center justify-center"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('work.complete')
            )}
          </button>
        )}
        {isCompleted && (
          <span className="text-green-600 text-tablet-sm">{'\u2713'}</span>
        )}
      </div>
    </div>
  );
}
