import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Table, Button, Space, Select, Tag, Drawer, Form, Input,
  InputNumber, DatePicker, App, Row, Col, Spin, Popconfirm, Divider,
  Tooltip, Progress, Statistic, Upload, List, Modal, Card, Dropdown, Popover, Checkbox,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, PaperClipOutlined, UndoOutlined, UploadOutlined, CloseCircleOutlined, FilePdfOutlined, EyeOutlined, CopyOutlined, FullscreenOutlined, FullscreenExitOutlined, QuestionCircleOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@algreen/auth';
import { OrderStatus, OrderType, ProcessStatus, ComplexityType, UserRole } from '@algreen/shared-types';
import type { OrderMasterViewDto, OrderDetailDto, OrderItemDto, OrderItemProcessDto, OrderItemSubProcessDto, ProcessDto, ProductCategoryDto, SpecialRequestTypeDto, AddOrderItemRequest } from '@algreen/shared-types';
import {
  useCreateOrder, useOrder, useActivateOrder,
  useUpdateOrder, useCancelOrder, usePauseOrder, useResumeOrder, useReopenOrder,
} from '../../hooks/useOrders';
import { productCategoriesApi, processesApi, ordersApi, specialRequestTypesApi, processWorkflowApi, blockRequestsApi, changeRequestsApi } from '@algreen/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../components/StatusBadge';
import { OrderAttachments, type OrderAttachmentsHandle } from '../../components/OrderAttachments';
import { compressFile } from '../../utils/compressImage';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useLayoutStore } from '../../stores/layout-store';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ─── Process status color mapping (matching Excel conditional formatting) ────

const processStatusColors: Record<ProcessStatus, string> = {
  [ProcessStatus.Completed]: '#92D050',   // Green - done
  [ProcessStatus.InProgress]: '#1890ff',  // Blue - in progress
  [ProcessStatus.Blocked]: '#FF0000',     // Red - blocked
  [ProcessStatus.Stopped]: '#FFAA00',     // Orange - stopped
  [ProcessStatus.Pending]: '#D9D9D9',     // Light gray - pending
  [ProcessStatus.Withdrawn]: '#F0F0F0',   // Very light gray - withdrawn
};

const orderTypeColors: Record<OrderType, string> = {
  [OrderType.Standard]: 'blue',
  [OrderType.Repair]: 'orange',
  [OrderType.Complaint]: 'red',
  [OrderType.Rework]: 'purple',
};

const orderTypeTextColors: Record<OrderType, string> = {
  [OrderType.Standard]: '#1677ff',
  [OrderType.Repair]: '#d46b08',
  [OrderType.Complaint]: '#cf1322',
  [OrderType.Rework]: '#531dab',
};

const orderStatusTextColors: Record<OrderStatus, string> = {
  [OrderStatus.Draft]: '#8c8c8c',
  [OrderStatus.Active]: '#389e0d',
  [OrderStatus.Paused]: '#d46b08',
  [OrderStatus.Cancelled]: '#cf1322',
  [OrderStatus.Completed]: '#08979c',
};

// ─── Helpers ─────────────────────────────────────────────

function getApiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function getTranslatedError(error: unknown, t: (key: string, opts?: Record<string, string>) => string, fallback: string): string {
  const resp = (error as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
  if (resp?.code) {
    const translated = t(`common:errors.${resp.code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return resp?.message || fallback;
}

/** Aggregate process status across all items in an order for a given processId (used in detail drawer) */
type AggregateState = {
  status: ProcessStatus | null;
  isReady: boolean;  // pending-ready or paused (gray + bold border)
  isPaused: boolean; // subset of isReady - show "Pauzirano" text
};

function getAggregateProcessState(
  order: OrderDetailDto,
  processId: string,
  processDependencies?: Record<string, string[]>,
): AggregateState {
  const procs = order.items
    .map((item) => item.processes.find((p) => p.processId === processId))
    .filter(Boolean) as OrderItemProcessDto[];

  if (procs.length === 0) return { status: null, isReady: false, isPaused: false };

  // Priority: Blocked > InProgress (running) > Paused/PendingReady > PendingNotReady > Completed
  const hasBlocked = procs.some((p) => p.status === ProcessStatus.Blocked);
  if (hasBlocked) return { status: ProcessStatus.Blocked, isReady: false, isPaused: false };

  const hasRunning = procs.some((p) => p.status === ProcessStatus.InProgress && !isPaused(p));
  if (hasRunning) return { status: ProcessStatus.InProgress, isReady: false, isPaused: false };

  const hasPaused = procs.some((p) => isPaused(p));
  const hasPendingReady = procs.some((p) => {
    if (p.status !== ProcessStatus.Pending) return false;
    const allDeps = processDependencies ?? {};
    const hasDeps = Object.keys(allDeps).length > 0;
    const deps = allDeps[processId];
    if (deps && deps.length > 0) {
      const item = order.items.find((it) => it.processes.some((ip) => ip.id === p.id));
      if (!item) return false;
      return deps.every((depId) => {
        const depProc = item.processes.find((ip) => ip.processId === depId);
        return depProc && (depProc.status === ProcessStatus.Completed || depProc.isWithdrawn);
      });
    }
    return hasDeps; // no deps in a dependency system = independent = ready
  });
  if (hasPaused || hasPendingReady) return { status: ProcessStatus.Pending, isReady: true, isPaused: hasPaused };

  const hasPending = procs.some((p) => p.status === ProcessStatus.Pending);
  if (hasPending) return { status: ProcessStatus.Pending, isReady: false, isPaused: false };

  if (procs.every((p) => p.status === ProcessStatus.Completed || p.isWithdrawn))
    return { status: ProcessStatus.Completed, isReady: false, isPaused: false };

  return { status: ProcessStatus.Completed, isReady: false, isPaused: false };
}

/** Count completed vs total processes across all items (used in detail drawer) */
function getCompletionInfo(order: OrderDetailDto): { completed: number; total: number } {
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
function getDeadlineLevel(
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

// ─── Process Status Cell (master table) ──────────────────

function statusColor(status: string | null, paused: boolean): string {
  if (paused) return '#faad14';
  if (!status) return '#999';
  return processStatusColors[status as ProcessStatus] ?? '#999';
}

function SubProcessTooltip({ subProcesses, processMap }: { subProcesses: OrderItemSubProcessDto[]; processMap: Map<string, ProcessDto> }) {
  const { tEnum } = useEnumTranslation();
  if (!subProcesses || subProcesses.length === 0) return null;
  const active = subProcesses.filter((sp) => !sp.isWithdrawn);
  if (active.length === 0) return null;
  return (
    <div style={{ marginTop: 4, paddingTop: 4, borderTop: '2px solid rgba(255,255,255,0.5)', fontSize: 11 }}>
      {active.map((sp) => {
        const spTime = sp.totalDurationMinutes + (sp.isTimerRunning && sp.currentLogStartedAt ? Math.floor((Date.now() - new Date(sp.currentLogStartedAt).getTime()) / 1000) : 0);
        // Find sub-process name from process definitions
        let spName = sp.subProcessId.slice(0, 6);
        for (const p of processMap.values()) {
          const found = p.subProcesses?.find((s) => s.id === sp.subProcessId);
          if (found) { spName = found.name; break; }
        }
        return (
          <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, opacity: sp.status === 'Completed' ? 0.7 : 1 }}>
            <span>↳ {spName}</span>
            <span style={{ color: statusColor(sp.status, false) }}>
              {tEnum('SubProcessStatus', sp.status)}
              {spTime > 0 ? ` ${formatDurationSec(spTime)}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatDurationSec(totalSec: number): string {
  if (totalSec <= 0) return '';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min ${s}s`;
  return `${m}min ${s}s`;
}

function calcLiveSeconds(proc: { status: string; totalDurationMinutes: number; startedAt: string | null; pausedAt: string | null; resumedAt: string | null; subProcesses?: { totalDurationMinutes: number; status: string; isWithdrawn: boolean; isTimerRunning?: boolean; currentLogStartedAt?: string | null }[] }): number {
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

function isPaused(proc: { status: string; pausedAt: string | null; subProcesses?: { status: string; isWithdrawn: boolean; isTimerRunning?: boolean }[] }): boolean {
  if (proc.status !== 'InProgress') return false;
  if (proc.subProcesses && proc.subProcesses.length > 0) {
    const active = proc.subProcesses.filter((sp) => !sp.isWithdrawn);
    const anyTimerRunning = active.some((sp) => sp.isTimerRunning);
    const allDone = active.every((sp) => sp.status === 'Completed');
    return !anyTimerRunning && !allDone;
  }
  return !!proc.pausedAt;
}

function ProcessCell({
  status,
  processName,
  isReady,
  duration,
  paused,
  tEnum,
}: {
  status: ProcessStatus | null;
  processName: string;
  isReady?: boolean;
  duration?: number;
  paused?: boolean;
  tEnum: (enumName: string, value: string) => string;
}) {
  const { t } = useTranslation('dashboard');
  if (status === null) {
    return (
      <div style={{
        width: 24,
        height: 24,
        margin: '0 auto',
        borderRadius: 4,
        border: '1px dashed #E0E0E0',
      }} />
    );
  }

  // Paused sub-process gap: show as orange with bold border instead of blue
  const showAsReady = paused && status === ProcessStatus.InProgress;
  const color = showAsReady ? '#FFAA00' : processStatusColors[status];
  const label = tEnum('ProcessStatus', status);

  const timeStr = duration ? formatDurationSec(duration) : '';

  return (
    <Tooltip title={<div><div><b>{processName}</b></div><div style={{ color: statusColor(status, !!paused) }}>{paused ? t('orders.paused') : label}</div>{timeStr && <div>{timeStr}</div>}</div>}>
      <div
        style={{
          width: 24,
          height: 24,
          margin: '0 auto',
          borderRadius: 4,
          backgroundColor: color,
          border: (isReady || showAsReady) ? '3px solid #333' : '1px solid rgba(0,0,0,0.1)',
          cursor: 'default',
        }}
      />
    </Tooltip>
  );
}

// ─── Status as plain colored text (drawer header) ────────

function StatusText({ status }: { status: OrderStatus }) {
  const { tEnum } = useEnumTranslation();
  return (
    <Text style={{ color: orderStatusTextColors[status], fontWeight: 500 }}>
      #{tEnum('OrderStatus', status)}
    </Text>
  );
}

// ─── Process Timeline (drawer) ───────────────────────────

function ProcessTimeline({
  order,
  processes,
  tEnum,
  processDependencies,
}: {
  order: OrderDetailDto;
  processes: ProcessDto[];
  tEnum: (enumName: string, value: string) => string;
  processDependencies?: Record<string, string[]>;
}) {
  const { t } = useTranslation('dashboard');
  const STEP = 48; // px per process step
  const CIRCLE = 24;
  const totalWidth = processes.length * STEP;

  // Pre-compute aggregate states
  const states = processes.map((proc) => getAggregateProcessState(order, proc.id, processDependencies));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ position: 'relative', width: totalWidth, height: 44, marginLeft: 4, marginRight: 4 }}>
        {/* Connector lines layer */}
        {processes.map((proc, i) => {
          if (i === 0) return null;
          const prevCompleted = states[i - 1]?.status === ProcessStatus.Completed;
          // Line goes from center of previous circle to center of current circle
          const x1 = (i - 1) * STEP + STEP / 2;
          const x2 = i * STEP + STEP / 2;
          return (
            <div
              key={`line-${proc.id}`}
              style={{
                position: 'absolute',
                left: x1,
                top: CIRCLE / 2 - 1,
                width: x2 - x1,
                height: 2,
                backgroundColor: prevCompleted ? '#92D050' : '#D9D9D9',
              }}
            />
          );
        })}
        {/* Circles + labels layer */}
        {processes.map((proc, i) => {
          const state = states[i];
          const { status, isReady, isPaused: aggPaused } = state;
          const isCompleted = status === ProcessStatus.Completed;
          const x = i * STEP;

          const totalSec = order.items.reduce((sum, item) => {
            const p = item.processes.find((ip) => ip.processId === proc.id);
            return sum + (p ? calcLiveSeconds(p) : 0);
          }, 0);
          const timeStr = formatDurationSec(totalSec);
          const showBold = isReady || aggPaused;
          const color = aggPaused ? '#FFAA00' : isReady ? '#D9D9D9' : (status ? processStatusColors[status] : '#F0F0F0');

          return (
            <Tooltip key={proc.id} title={<div><div><b>{proc.name}</b></div><div style={{ color: statusColor(status, aggPaused) }}>{aggPaused ? t('orders.paused') : (status ? tEnum('ProcessStatus', status) : t('orders.processNotApplicable'))}</div>{timeStr && <div>{timeStr}</div>}</div>}>
              <div style={{ position: 'absolute', left: x, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: STEP }}>
                <div style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: showBold ? '3px solid #333' : ('2px solid ' + (status ? color : '#D9D9D9')),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {isCompleted && <CheckOutlined style={{ fontSize: 12, color: '#fff' }} />}
                </div>
                <Text style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: '#888',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: STEP - 4,
                  textAlign: 'center',
                  display: 'block',
                }}>{proc.code}</Text>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ─── Item Process Rectangles (drawer item cards) ─────────

function ItemProcessBar({
  item,
  processMap,
  tEnum,
  onRestart,
  canRestart,
  processDependencies,
}: {
  item: OrderItemDto;
  processMap: Map<string, ProcessDto>;
  tEnum: (enumName: string, value: string) => string;
  onRestart?: (orderItemProcessId: string, resetTime: boolean) => void;
  canRestart?: boolean;
  processDependencies?: Record<string, string[]>;
}) {
  const { t } = useTranslation('dashboard');
  const sorted = [...item.processes]
    .filter((p) => p.status !== ProcessStatus.Withdrawn)
    .sort((a, b) => {
      const pa = processMap.get(a.processId);
      const pb = processMap.get(b.processId);
      return (pa?.sequenceOrder ?? 0) - (pb?.sequenceOrder ?? 0);
    });

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {sorted.map((proc, idx) => {
        const process = processMap.get(proc.processId);
        const procPaused = isPaused(proc);
        // Check if this Pending process is ready to start (using dependencies if available)
        let isReady = false;
        if (proc.status === ProcessStatus.Pending) {
          const allDeps = processDependencies ?? {};
          const hasDependencySystem = Object.keys(allDeps).length > 0;
          const deps = allDeps[proc.processId];
          if (deps && deps.length > 0) {
            isReady = deps.every((depId) => {
              const depProc = sorted.find((p) => p.processId === depId);
              return depProc && (depProc.status === ProcessStatus.Completed || depProc.isWithdrawn);
            });
          } else if (hasDependencySystem) {
            isReady = true;
          } else if (idx === 0) {
            isReady = true;
          } else {
            const prev = sorted[idx - 1];
            isReady = prev.status === ProcessStatus.Completed || prev.isWithdrawn;
          }
        }
        const color = procPaused ? '#FFAA00' : processStatusColors[proc.status];
        const statusLabel = tEnum('ProcessStatus', proc.status);
        return (
          canRestart && proc.status === ProcessStatus.Completed && onRestart ? (
            <Dropdown
              key={proc.id}
              trigger={['click']}
              menu={{
                items: [
                  { key: 'keep', label: t('orders.restartKeepTime'), onClick: () => onRestart(proc.id, false) },
                  { key: 'reset', label: t('orders.restartResetTime'), onClick: () => onRestart(proc.id, true) },
                ],
              }}
            >
              <Tooltip title={<div><div><b>{process?.name ?? proc.processId}</b></div><div style={{ color: statusColor(proc.status, procPaused) }}>{procPaused ? t('orders.paused') : statusLabel}</div>{calcLiveSeconds(proc) > 0 && <div>{formatDurationSec(calcLiveSeconds(proc))}</div>}{proc.subProcesses && <SubProcessTooltip subProcesses={proc.subProcesses} processMap={processMap} />}</div>}>
                <div style={{
                  padding: '2px 6px', borderRadius: 4, backgroundColor: color,
                  border: (procPaused || isReady) ? '3px solid #333' : '1px solid rgba(0,0,0,0.1)', fontSize: 11, fontWeight: 500,
                  color: (procPaused || isReady) ? '#666' : '#fff', cursor: 'pointer', lineHeight: '16px',
                }}>
                  {process?.code ?? '?'}{proc.complexity ? <span style={{ opacity: 0.85 }}> {proc.complexity}</span> : null}
                </div>
              </Tooltip>
            </Dropdown>
          ) : (
            <Tooltip
              key={proc.id}
              title={
                <div>
                  <div><b>{process?.name ?? proc.processId}</b></div>
                  <div style={{ color: statusColor(proc.status, procPaused) }}>{procPaused ? t('orders.paused') : statusLabel}</div>
                  {(proc.complexity || calcLiveSeconds(proc) > 0) && (
                    <div>{proc.complexity ?? ''}{calcLiveSeconds(proc) > 0 ? `${proc.complexity ? ' · ' : ''}${formatDurationSec(calcLiveSeconds(proc))}` : ''}</div>
                  )}
                  {proc.subProcesses && <SubProcessTooltip subProcesses={proc.subProcesses} processMap={processMap} />}
                </div>
              }
            >
              <div style={{
                padding: '2px 6px', borderRadius: 4, backgroundColor: color,
                border: (procPaused || isReady) ? '3px solid #333' : '1px solid rgba(0,0,0,0.1)', fontSize: 11, fontWeight: 500,
                color: proc.status === ProcessStatus.Pending || proc.status === ProcessStatus.Withdrawn || procPaused ? '#666' : '#fff',
                cursor: 'default', lineHeight: '16px',
              }}>
                {process?.code ?? '?'}{proc.complexity ? <span style={{ opacity: 0.85 }}> {proc.complexity}</span> : null}
              </div>
            </Tooltip>
          )
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function OrderListPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.tenantId);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>('priority');
  const [sortDirection, setSortDirection] = useState<string | undefined>('asc');
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('orders-pageSize');
    return saved ? Number(saved) : 20;
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, orderTypeFilter, dateFrom, dateTo]);

  const { data: masterResult, isLoading } = useQuery({
    queryKey: ['orders-master-view', tenantId, statusFilter, orderTypeFilter, debouncedSearch, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => ordersApi.getMasterView({
      tenantId: tenantId!,
      status: statusFilter,
      orderType: orderTypeFilter,
      search: debouncedSearch || undefined,
      dateFrom: dateFrom?.format('YYYY-MM-DD'),
      dateTo: dateTo?.format('YYYY-MM-DD'),
      page,
      pageSize,
      sortBy,
      sortDirection,
    }).then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(() => searchParams.get('detail'));

  // Clear detail param from URL after reading it
  useEffect(() => {
    if (searchParams.has('detail')) {
      searchParams.delete('detail');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [addingItem, setAddingItem] = useState(false);
  const [createPendingItems, setCreatePendingItems] = useState<AddOrderItemRequest[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Map<number, File[]>>(new Map()); // key: item index, -1 for order-level
  const [pendingPreview, setPendingPreview] = useState<string | null>(null); // blob URL for image/PDF preview
  const [pendingPreviewType, setPendingPreviewType] = useState<'image' | 'pdf'>('image');

  const openPendingPreview = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    if (file.type === 'application/pdf') {
      setPendingPreviewType('pdf');
      setPendingPreview(url + '#toolbar=0&navpanes=0');
    } else {
      setPendingPreviewType('image');
      setPendingPreview(url);
    }
  }, []);

  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();

  const [localPriority, setLocalPriority] = useState<number | null>(null);
  const attachmentRefsMap = useRef<Map<string, OrderAttachmentsHandle>>(new Map());
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const { guardedClose: guardedDrawerClose, onValuesChange: onCreateValuesChange } = useUnsavedChanges(isCreating);
  const { guardedClose: guardedEditClose, onValuesChange: onEditValuesChange } = useUnsavedChanges(!!detailOrderId);
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const fullscreen = useLayoutStore((s) => s.fullscreen);
  const setFullscreen = useLayoutStore((s) => s.setFullscreen);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    };
  }, [setFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);
  const cancelOrder = useCancelOrder();
  const reopenOrder = useReopenOrder();
  const pauseOrder = usePauseOrder();
  const resumeOrder = useResumeOrder();
  const { data: detailOrder, isLoading: detailLoading } = useOrder(detailOrderId ?? undefined);
  // Fetch processDependencies for the detail order independently from paginated master view
  const { data: detailDeps } = useQuery({
    queryKey: ['order-detail-deps', tenantId, detailOrderId],
    queryFn: () =>
      ordersApi.getMasterView({ tenantId: tenantId!, search: detailOrder!.orderNumber, page: 1, pageSize: 1 }).then((r) => {
        const entry = r.data.items.find((o) => o.id === detailOrderId);
        return entry?.processDependencies ?? {};
      }),
    enabled: !!tenantId && !!detailOrderId && !!detailOrder,
    staleTime: 10_000,
  });

  // Fetch block & change requests for the detail order
  const { data: detailBlockRequests } = useQuery({
    queryKey: ['order-detail-block-requests', tenantId, detailOrderId],
    queryFn: () => blockRequestsApi.getAll({ tenantId: tenantId!, orderId: detailOrderId!, pageSize: 50 }).then((r) => r.data.items),
    enabled: !!tenantId && !!detailOrderId,
    staleTime: 10_000,
  });
  const { data: detailChangeRequests } = useQuery({
    queryKey: ['order-detail-change-requests', tenantId, detailOrderId],
    queryFn: () => changeRequestsApi.getAll({ tenantId: tenantId!, orderId: detailOrderId!, pageSize: 50 }).then((r) => r.data.items),
    enabled: !!tenantId && !!detailOrderId,
    staleTime: 10_000,
  });
  // Tick every 10s to update live timer calculations in tooltips
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    if (!detailOrderId) return;
    const interval = setInterval(() => setTimerTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, [detailOrderId]);
  const activateMutation = useActivateOrder();
  const { data: categories } = useQuery({
    queryKey: ['product-categories', tenantId],
    queryFn: () => productCategoriesApi.getAll({ tenantId: tenantId!, pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });
  const { data: specialRequestTypes } = useQuery({
    queryKey: ['special-request-types', tenantId],
    queryFn: () => specialRequestTypesApi.getAll({ tenantId: tenantId!, pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId && !!detailOrderId,
  });
  const srtMap = useMemo(() => {
    const map = new Map<string, SpecialRequestTypeDto>();
    (specialRequestTypes ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [specialRequestTypes]);
  const { message, modal } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  // Fetch all processes for master view columns
  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll({ tenantId: tenantId!, pageSize: 100 }).then((r) =>
      [...r.data.items].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    ),
    enabled: !!tenantId,
  });

  // Process lookup map
  const processMap = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    (processes ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [processes]);

  const queryClient = useQueryClient();

  // ─── Pending state for unified form ──────────────────────
  const [pendingItems, setPendingItems] = useState<AddOrderItemRequest[]>([]);
  const [pendingItemRemovals, setPendingItemRemovals] = useState<string[]>([]);
  const [pendingComplexity, setPendingComplexity] = useState<Map<string, ComplexityType>>(new Map());
  const [pendingSpecialRequestAdds, setPendingSpecialRequestAdds] = useState<{ itemId: string; specialRequestTypeId: string }[]>([]);
  const [pendingSpecialRequestRemovals, setPendingSpecialRequestRemovals] = useState<{ itemId: string; specialRequestId: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNewItemFiles, setPendingNewItemFiles] = useState<Map<number, File[]>>(new Map());
  const [currentDraftItemFiles, setCurrentDraftItemFiles] = useState<File[]>([]);
  const [editingOrderNumber, setEditingOrderNumber] = useState(false);
  const [orderNumberDraft, setOrderNumberDraft] = useState('');
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [deliveryDateDraft, setDeliveryDateDraft] = useState<dayjs.Dayjs | null>(null);
  const [savingInline, setSavingInline] = useState(false);

  const clearPendingState = useCallback(() => {
    setPendingItems([]);
    setPendingItemRemovals([]);
    setPendingComplexity(new Map());
    setPendingSpecialRequestAdds([]);
    setPendingSpecialRequestRemovals([]);
    setPendingNewItemFiles(new Map());
    setCurrentDraftItemFiles([]);
    setAddingItem(false);
  }, []);

  const hasPendingChanges = pendingItems.length > 0 || pendingItemRemovals.length > 0 || pendingComplexity.size > 0 || pendingSpecialRequestAdds.length > 0 || pendingSpecialRequestRemovals.length > 0;

  const changePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) => ordersApi.changePriority(id, priority),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.id] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { targetProcessId: string; reason: string; userId: string } }) =>
      ordersApi.withdraw(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      queryClient.invalidateQueries({ queryKey: ['orders', detailOrderId] });
    },
  });

  const setInvoicedMutation = useMutation({
    mutationFn: ({ id, isInvoiced }: { id: string; isInvoiced: boolean }) =>
      ordersApi.setInvoiced(id, isInvoiced),
    onMutate: async ({ id, isInvoiced }) => {
      await queryClient.cancelQueries({ queryKey: ['orders-master-view'] });
      const previous = queryClient.getQueriesData({ queryKey: ['orders-master-view'] });
      queryClient.setQueriesData({ queryKey: ['orders-master-view'] }, (old: unknown) => {
        const data = old as { items?: OrderMasterViewDto[] } | undefined;
        if (!data?.items) return old;
        return { ...data, items: data.items.map((o) => o.id === id ? { ...o, isInvoiced } : o) };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      message.error(t('orders.updateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    },
  });

  const saveInlineOrderNumber = useCallback(async () => {
    if (!detailOrder) return;
    const newValue = orderNumberDraft.trim();
    if (!newValue) { message.error(t('common:errors.INVALID_ORDER_NUMBER')); return; }
    if (newValue === detailOrder.orderNumber) { setEditingOrderNumber(false); return; }
    setSavingInline(true);
    try {
      await updateOrder.mutateAsync({ id: detailOrder.id, data: { orderNumber: newValue } });
      await queryClient.invalidateQueries({ queryKey: ['orders', detailOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      message.success(t('orders.updatedSuccess'));
      setEditingOrderNumber(false);
    } catch (err) {
      message.error(getTranslatedError(err, t, t('orders.updateFailed')));
    } finally {
      setSavingInline(false);
    }
  }, [detailOrder, orderNumberDraft, updateOrder, queryClient, t, message]);

  const saveInlineDeliveryDate = useCallback(async () => {
    if (!detailOrder || !deliveryDateDraft) return;
    const iso = dayjs(deliveryDateDraft).format('YYYY-MM-DD') + 'T12:00:00Z';
    if (dayjs(iso).isSame(dayjs(detailOrder.deliveryDate), 'day')) { setEditingDeliveryDate(false); return; }
    setSavingInline(true);
    try {
      await updateOrder.mutateAsync({ id: detailOrder.id, data: { deliveryDate: iso } });
      await queryClient.invalidateQueries({ queryKey: ['orders', detailOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      message.success(t('orders.updatedSuccess'));
      setEditingDeliveryDate(false);
    } catch (err) {
      message.error(getTranslatedError(err, t, t('orders.updateFailed')));
    } finally {
      setSavingInline(false);
    }
  }, [detailOrder, deliveryDateDraft, updateOrder, queryClient, t, message]);

  useEffect(() => {
    if (detailOrder) {
      const isEditableStatus =
        detailOrder.status === OrderStatus.Draft ||
        detailOrder.status === OrderStatus.Active ||
        detailOrder.status === OrderStatus.Paused;
      if (isEditableStatus) {
        editForm.setFieldsValue({
          notes: detailOrder.notes,
          customWarningDays: detailOrder.customWarningDays,
          customCriticalDays: detailOrder.customCriticalDays,
        });
      }
      setLocalPriority(detailOrder.priority);
      setOrderNumberDraft(detailOrder.orderNumber);
      setDeliveryDateDraft(dayjs(detailOrder.deliveryDate));
      setEditingOrderNumber(false);
      setEditingDeliveryDate(false);
    }
  }, [detailOrder, editForm]);

  // Clear pending state when order changes
  useEffect(() => {
    clearPendingState();
  }, [detailOrderId, clearPendingState]);

  const canCreate =
    user?.role === UserRole.SalesManager ||
    user?.role === UserRole.Manager ||
    user?.role === UserRole.Admin;

  const onCreateFinish = async (values: Record<string, unknown>) => {
    try {
      // Compress order-level attachments
      const orderFiles = pendingFiles.get(-1) ?? [];
      const compressedOrderFiles = await Promise.all(orderFiles.map((f) => compressFile(f)));
      // Compress per-item attachments
      const compressedItemAttachments = new Map<number, File[]>();
      for (const [key, files] of pendingFiles.entries()) {
        if (key === -1) continue; // skip order-level
        const compressed = await Promise.all(files.map((f) => compressFile(f)));
        if (compressed.length > 0) compressedItemAttachments.set(key, compressed);
      }
      await createOrder.mutateAsync({
        tenantId: tenantId!,
        orderNumber: values.orderNumber as string,
        deliveryDate: dayjs(values.deliveryDate as string).format('YYYY-MM-DD') + 'T12:00:00Z',
        priority: values.priority as number,
        orderType: values.orderType as OrderType,
        notes: values.notes as string | undefined,
        customWarningDays: values.customWarningDays as number | undefined,
        customCriticalDays: values.customCriticalDays as number | undefined,
        items: createPendingItems.length > 0 ? createPendingItems : undefined,
        attachments: compressedOrderFiles.length > 0 ? compressedOrderFiles : undefined,
        itemAttachments: compressedItemAttachments.size > 0 ? compressedItemAttachments : undefined,
      });
      message.success(t('orders.createdSuccess'));
      form.resetFields();
      setCreatePendingItems([]);
      setPendingFiles(new Map());
      setAddingItem(false);
      setIsCreating(false);
    } catch (err) {
      message.error(getTranslatedError(err, t, t('orders.createFailed')));
    }
  };

  // ─── Master table columns ──────────────────────────────

  const masterColumns: ColumnsType<OrderMasterViewDto> = useMemo(() => {
    const base: ColumnsType<OrderMasterViewDto> = [
      {
        title: t('common:labels.priority'),
        dataIndex: 'priority',
        width: 70,
        sorter: true,
        sortOrder: sortBy === 'priority' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
      },
      {
        title: t('orders.orderNumber'),
        dataIndex: 'orderNumber',
        width: 160,
        sorter: true,
        sortOrder: sortBy === 'orderNumber' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
        render: (text: string, record: OrderMasterViewDto) => (
          <Space size={4}>
            <span style={{ fontWeight: 500 }}>{text}</span>
            {record.attachmentCount > 0 && (
              <Tooltip title={`${record.attachmentCount} ${record.attachmentCount === 1 ? 'dokument' : 'dokumenata'}`}>
                <PaperClipOutlined style={{ color: '#1677ff', fontSize: 13 }} />
              </Tooltip>
            )}
          </Space>
        ),
      },
      {
        title: t('orders.orderType'),
        dataIndex: 'orderType',
        width: 90,
        sorter: true,
        sortOrder: sortBy === 'orderType' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
        render: (type: OrderType) => (
          <Tag color={orderTypeColors[type]}>{tEnum('OrderType', type)}</Tag>
        ),
      },
      {
        title: t('common:labels.status'),
        dataIndex: 'status',
        width: 110,
        sorter: true,
        sortOrder: sortBy === 'status' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
        render: (status) => <StatusBadge status={status} />,
      },
      {
        title: t('common:labels.created'),
        dataIndex: 'createdAt',
        width: 105,
        render: (d: string) => d ? dayjs(d).format('DD.MM.YYYY.') : '—',
        sorter: true,
        sortOrder: sortBy === 'createdAt' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
      },
      {
        title: t('common:labels.completed'),
        dataIndex: 'completedAt',
        width: 105,
        render: (d: string | null) => d ? dayjs(d).format('DD.MM.YYYY.') : '—',
        sorter: true,
        sortOrder: sortBy === 'completedAt' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
      },
      {
        title: t('orders.invoiced'),
        dataIndex: 'isInvoiced',
        width: 90,
        align: 'center' as const,
        render: (invoiced: boolean, record: OrderMasterViewDto) => (
          <span onClick={(e) => e.stopPropagation()}>
            {invoiced ? (
              <Popconfirm
                title={t('orders.uninvoiceConfirm')}
                onConfirm={(e) => { e?.stopPropagation(); setInvoicedMutation.mutate({ id: record.id, isInvoiced: false }); }}
                onCancel={(e) => e?.stopPropagation()}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.cancel')}
              >
                <Checkbox checked />
              </Popconfirm>
            ) : (
              <Checkbox
                checked={false}
                onChange={(e) => {
                  setInvoicedMutation.mutate({ id: record.id, isInvoiced: e.target.checked });
                }}
              />
            )}
          </span>
        ),
      },
      {
        title: t('common:labels.deliveryDate'),
        dataIndex: 'deliveryDate',
        width: 110,
        sorter: true,
        sortOrder: sortBy === 'deliveryDate' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
        render: (date: string, record: OrderMasterViewDto) => {
          const level = getDeadlineLevel(date, record.customWarningDays, record.customCriticalDays);
          const isCompleted = record.status === OrderStatus.Completed;
          const color = isCompleted ? undefined :
            level === 'critical' ? '#FF0000' :
            level === 'warning' ? '#FAAD14' : undefined;
          return (
            <span style={{ color, fontWeight: color ? 600 : undefined }}>
              {dayjs(date).format('DD.MM.YYYY.')}
            </span>
          );
        },
      },
    ];

    // Add one column per process
    const processList = processes ?? [];
    const processColDefs: ColumnsType<OrderMasterViewDto> = processList.map((proc, idx) => ({
      title: (
        <Tooltip title={`${proc.code} — ${proc.name}`}>
          <span style={{ fontSize: 11, cursor: 'default' }}>{proc.name}</span>
        </Tooltip>
      ),
      key: proc.id,
      width: 44,
      align: 'center' as const,
      render: (_: unknown, record: OrderMasterViewDto) => {
        const statusStr = record.processStatuses[proc.id];
        const status = statusStr ? (statusStr as ProcessStatus) : null;
        // "Ready" = Pending + all dependencies completed
        let isReady = false;
        if (status === ProcessStatus.Pending && record.status === OrderStatus.Active) {
          const allDeps = record.processDependencies ?? {};
          const hasDependencySystem = Object.keys(allDeps).length > 0;
          const deps = allDeps[proc.id];
          if (deps && deps.length > 0) {
            // Has explicit dependencies: ready when ALL are completed
            isReady = deps.every((depId) => record.processStatuses[depId] === ProcessStatus.Completed);
          } else if (hasDependencySystem) {
            // Category uses dependencies but this process has none → independent, always ready
            isReady = true;
          } else {
            // No dependency system at all → sequential fallback
            if (idx === 0) {
              isReady = true;
            } else {
              for (let i = idx - 1; i >= 0; i--) {
                const prevStatus = record.processStatuses[processList[i].id];
                if (prevStatus) {
                  isReady = prevStatus === ProcessStatus.Completed;
                  break;
                }
              }
            }
          }
        }
        const duration = record.processDurations?.[proc.id] ?? 0;
        const processPaused = record.processPaused?.[proc.id] ?? false;
        return <ProcessCell status={status} processName={proc.name} isReady={isReady} duration={duration} paused={processPaused} tEnum={tEnum} />;
      },
    }));

    // Completion column
    const completionCol: ColumnsType<OrderMasterViewDto> = [
      {
        title: t('orders.completion'),
        key: 'completion',
        width: 120,
        render: (_: unknown, record: OrderMasterViewDto) => {
          const { completedProcesses, totalProcesses } = record;
          const percent = totalProcesses > 0 ? Math.round((completedProcesses / totalProcesses) * 100) : 0;
          return (
            <Tooltip title={t('orders.completedOf', { completed: String(completedProcesses), total: String(totalProcesses) })}>
              <Progress
                percent={percent}
                size="small"
                strokeColor={percent === 100 ? '#92D050' : undefined}
                style={{ marginBottom: 0, minWidth: 80 }}
              />
            </Tooltip>
          );
        },
      },
    ];

    return [...base, ...completionCol, ...processColDefs];
  }, [processes, statusFilter, sortBy, sortDirection, t, tEnum]);

  // ─── Drawer detail helpers ─────────────────────────────

  const detailCompletion = useMemo(() => {
    if (!detailOrder) return { completed: 0, total: 0, percent: 0 };
    const info = getCompletionInfo(detailOrder);
    return { ...info, percent: info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0 };
  }, [detailOrder]);

  const detailDeadlineLevel = useMemo(() => {
    if (!detailOrder) return 'normal' as const;
    return getDeadlineLevel(detailOrder.deliveryDate, detailOrder.customWarningDays, detailOrder.customCriticalDays);
  }, [detailOrder]);

  const deliveryDateColor = detailOrder?.status === OrderStatus.Completed ? undefined :
    detailDeadlineLevel === 'critical' ? '#FF0000' :
    detailDeadlineLevel === 'warning' ? '#FAAD14' : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('orders.title')}
        </Title>
        <Space>
          <Popover
            trigger="click"
            placement="bottomRight"
            title={t('orders.legend.title')}
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
                {[
                  { color: '#92D050', label: t('orders.legend.completed') },
                  { color: '#1890ff', label: t('orders.legend.inProgress') },
                  { color: '#FF0000', label: t('orders.legend.blocked') },
                  { color: '#FFAA00', label: t('orders.legend.stopped') },
                  { color: '#D9D9D9', label: t('orders.legend.pending') },
                ].map((entry) => (
                  <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 18, height: 18, background: entry.color, border: '1px solid #ccc', display: 'inline-block' }} />
                    <span>{entry.label}</span>
                  </div>
                ))}
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, background: '#fff', border: '1px dashed #E0E0E0', display: 'inline-block' }} />
                  <span>{t('orders.legend.notApplicable')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, background: '#D9D9D9', border: '2px solid #333', display: 'inline-block' }} />
                  <span>{t('orders.legend.readyBorder')}</span>
                </div>
              </div>
            }
          >
            <Tooltip title={t('orders.legend.title')}>
              <Button icon={<QuestionCircleOutlined />} />
            </Tooltip>
          </Popover>
          <Tooltip title={fullscreen ? t('common:actions.exitFullscreen') : t('common:actions.fullscreen')}>
            <Button
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            />
          </Tooltip>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                itemForm.resetFields();
                setCreatePendingItems([]);
                setPendingFiles(new Map());
                setAddingItem(true);
                const maxPriority = (masterResult?.items ?? []).reduce((max, o) => Math.max(max, o.priority), 0);
                form.setFieldValue('priority', maxPriority + 10);
                setIsCreating(true);
              }}
            >
              {t('orders.createOrder')}
            </Button>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <Select
          placeholder={t('orders.filterByStatus')}
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 160 }}
          options={Object.values(OrderStatus).map((s) => ({ label: tEnum('OrderStatus', s), value: s }))}
        />
        <Select
          placeholder={t('orders.orderType')}
          allowClear
          value={orderTypeFilter}
          onChange={(v) => setOrderTypeFilter(v)}
          style={{ width: 160 }}
          options={Object.values(OrderType).map((ot) => ({ label: tEnum('OrderType', ot), value: ot }))}
        />
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateFrom')}
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateTo')}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table<OrderMasterViewDto>
          className="master-table"
          columns={masterColumns}
          dataSource={masterResult?.items}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: masterResult?.totalCount ?? 0,
            showSizeChanger: true,
          }}
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          size="small"
          bordered
          onRow={(record) => ({
            onClick: () => setDetailOrderId(record.id),
            style: { cursor: 'pointer' },
          })}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.pageSize !== pageSize) {
              const newSize = pagination.pageSize ?? 20;
              setPageSize(newSize);
              localStorage.setItem('orders-pageSize', String(newSize));
              setPage(1);
              return;
            }
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const newField = (s?.order ? (s.field as string) : undefined) ?? 'priority';
            const newDir = (s?.order === 'descend' ? 'desc' : s?.order === 'ascend' ? 'asc' : undefined) ?? 'asc';
            if (newField !== sortBy || newDir !== sortDirection) {
              setSortBy(newField);
              setSortDirection(newDir);
              setPage(1);
              return;
            }
            if (pagination.current !== page) setPage(pagination.current ?? 1);
          }}
          rowClassName={(record, index) => {
            const classes: string[] = [];
            if (record.status === OrderStatus.Completed) classes.push('master-row-completed');
            if (record.status === OrderStatus.Cancelled) classes.push('master-row-cancelled');
            // Separator between active/paused and other statuses (only when sorting by status)
            if (sortBy === 'status') {
              const items = masterResult?.items ?? [];
              const isActive = record.status === OrderStatus.Active || record.status === OrderStatus.Paused;
              const nextItem = items[index + 1];
              if (nextItem) {
                const nextIsActive = nextItem.status === OrderStatus.Active || nextItem.status === OrderStatus.Paused;
                if (isActive !== nextIsActive) {
                  classes.push('master-row-separator');
                }
              }
            }
            return classes.join(' ');
          }}
        />
      </div>

      <style>{`
        .master-table .master-row-completed td {
          background-color: rgba(146, 208, 80, 0.1) !important;
        }
        .master-table .master-row-cancelled td {
          opacity: 0.5;
        }
        .master-table .master-row-separator td {
          border-bottom: 3px solid #ff9800 !important;
        }
      `}</style>

      {/* Unified Order Drawer — handles both create and edit/detail */}
      <Drawer
        title={isCreating ? t('orders.createOrder') : detailOrder ? (
          editingOrderNumber ? (
            <Space size={4}>
              <Input
                size="small"
                style={{ width: 180 }}
                value={orderNumberDraft}
                autoFocus
                onChange={(e) => setOrderNumberDraft(e.target.value)}
                onPressEnter={saveInlineOrderNumber}
              />
              <Button size="small" type="primary" loading={savingInline} icon={<CheckOutlined />} onClick={saveInlineOrderNumber} />
              <Button size="small" icon={<CloseCircleOutlined />} onClick={() => { setOrderNumberDraft(detailOrder.orderNumber); setEditingOrderNumber(false); }} />
            </Space>
          ) : (
            <Space size={4}>
              <span>{t('orders.order', { number: detailOrder.orderNumber })}</span>
              {detailOrder.status !== OrderStatus.Completed && detailOrder.status !== OrderStatus.Cancelled && user?.role !== UserRole.SalesManager && (
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingOrderNumber(true)} />
              )}
            </Space>
          )
        ) : ''}
        open={isCreating || !!detailOrderId}
        onClose={(e) => {
          const doClose = () => {
            if (isCreating) { form.resetFields(); setCreatePendingItems([]); setPendingFiles(new Map()); setAddingItem(false); setIsCreating(false); }
            else { setDetailOrderId(null); clearPendingState(); setAddingItem(false); }
          };
          if (isCreating) guardedDrawerClose(doClose, e);
          else guardedEditClose(doClose, e);
        }}
        width={Math.min(640, window.innerWidth)}
        extra={
          isCreating ? (
            <Button type="primary" onClick={() => form.submit()} loading={createOrder.isPending}>
              {t('common:actions.save')}
            </Button>
          ) : detailOrder && detailOrder.status === OrderStatus.Draft && user?.role !== UserRole.SalesManager ? (
            <Button type="primary" loading={isSaving} disabled={isSaving} onClick={async () => {
              if (isSaving) return;
              try {
                const values = await editForm.validateFields();
                setIsSaving(true);
                try {
                  const isDraft = detailOrder.status === OrderStatus.Draft;
                  const complexityOverrides = Array.from(pendingComplexity.entries()).map(([key, complexity]) => {
                    const [itemId, processId] = key.split(':');
                    return { itemId, processId, complexity };
                  });
                  const existingItemIds = new Set(detailOrder.items.map((i) => i.id));
                  await updateOrder.mutateAsync({
                    id: detailOrder.id,
                    data: {
                      notes: isDraft ? values.notes : undefined,
                      customWarningDays: isDraft ? values.customWarningDays : undefined,
                      customCriticalDays: isDraft ? values.customCriticalDays : undefined,
                      addItems: isDraft && pendingItems.length > 0 ? pendingItems : undefined,
                      removeItemIds: isDraft && pendingItemRemovals.length > 0 ? pendingItemRemovals : undefined,
                      complexityOverrides: complexityOverrides.length > 0 ? complexityOverrides : undefined,
                      addSpecialRequests: isDraft && pendingSpecialRequestAdds.length > 0 ? pendingSpecialRequestAdds : undefined,
                      removeSpecialRequests: isDraft && pendingSpecialRequestRemovals.length > 0 ? pendingSpecialRequestRemovals : undefined,
                    },
                  });
                  // Upload files for newly added items
                  if (pendingNewItemFiles.size > 0) {
                    const freshOrder = await ordersApi.getById(detailOrder.id).then((r) => r.data);
                    const newItems = freshOrder.items.filter((i) => !existingItemIds.has(i.id));
                    for (const [pendingIdx, files] of pendingNewItemFiles.entries()) {
                      const targetItem = newItems[pendingIdx];
                      if (!targetItem || files.length === 0) continue;
                      for (const file of files) {
                        try {
                          const compressed = await compressFile(file);
                          await ordersApi.uploadAttachment(detailOrder.id, compressed, tenantId!, targetItem.id);
                        } catch { /* skip failed uploads */ }
                      }
                    }
                  }
                  // Save pending attachment changes (uploads + deletes)
                  for (const handle of attachmentRefsMap.current.values()) {
                    try {
                      if (handle.hasPendingChanges()) await handle.savePending();
                    } catch { /* skip failed attachment saves */ }
                  }
                  // Save priority if changed
                  if (localPriority != null && localPriority !== detailOrder.priority && localPriority > 0) {
                    await changePriorityMutation.mutateAsync({ id: detailOrder.id, priority: localPriority });
                  }
                  await queryClient.invalidateQueries({ queryKey: ['orders', detailOrder.id] });
                  queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
                  clearPendingState();
                  message.success(t('orders.updatedSuccess'));
                } catch (err) {
                  message.error(getTranslatedError(err, t, t('orders.updateFailed')));
                }
              } catch {
                // validation failed
              } finally {
                setIsSaving(false);
              }
            }}>
              {t('common:actions.save')}
            </Button>
          ) : undefined
        }
      >
        {isCreating ? (
          <>
            {/* ── CREATE MODE ── */}
            <Form form={form} layout="vertical" onFinish={onCreateFinish} onValuesChange={onCreateValuesChange} scrollToFirstError={{ behavior: "smooth", block: "center" }}>
              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item
                    name="orderNumber"
                    label={t('orders.orderNumberLabel')}
                    rules={[{ required: true }, { whitespace: true, message: t('common:errors.INVALID_ORDER_NUMBER') }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    name="orderType"
                    label={t('orders.orderType')}
                    rules={[{ required: true }]}
                  >
                    <Select options={Object.values(OrderType).map((ot) => ({ label: tEnum('OrderType', ot), value: ot }))} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="priority" label={t('common:labels.priority')} rules={[{ required: true }, { type: 'number', min: 1, message: t('common:errors.INVALID_PRIORITY') }]}>
                    <InputNumber min={1} max={100000} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    name="deliveryDate"
                    label={t('common:labels.deliveryDate')}
                    rules={[
                      { required: true },
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          const selected = new Date(value.format ? value.format('YYYY-MM-DD') : value).getTime();
                          const tomorrow = new Date(dayjs().add(1, 'day').format('YYYY-MM-DD')).getTime();
                          if (selected < tomorrow) return Promise.reject(t('common:errors.INVALID_DATE'));
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.format('YYYY-MM-DD') <= dayjs().format('YYYY-MM-DD')} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="notes" label={t('common:labels.notes')}>
                <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="customWarningDays" label={t('orders.warningDays')}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="customCriticalDays" label={t('orders.criticalDays')}>
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Divider style={{ margin: '12px 0' }} />

            {/* Items section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('orders.items', { count: createPendingItems.length })}
              </Title>
              {!addingItem && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingItem(true)}>
                  {t('orders.addItem')}
                </Button>
              )}
            </div>

            {/* Add Item form — component={false} prevents nested <form> tag */}
            {addingItem && (
              <>
                <Form form={itemForm} component={false} onFinish={(values) => {
                  setCreatePendingItems((prev) => [...prev, values as AddOrderItemRequest]);
                  itemForm.resetFields();
                }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="productCategoryId" label={t('orders.productCategory')} rules={[{ required: true }]}>
                        <Select showSearch popupMatchSelectWidth={false} filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())} options={(categories ?? []).map((c: ProductCategoryDto) => ({ label: c.name, value: c.id }))} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="productName" label={t('orders.productName')}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="quantity" label={t('orders.quantity')} rules={[{ required: true, message: t('common:errors.INVALID_QUANTITY') }, { type: 'number', min: 1, message: t('common:errors.INVALID_QUANTITY') }]}>
                        <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="notes" label={t('common:labels.notes')}>
                        <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" onClick={() => itemForm.submit()}>{t('orders.addItem')}</Button>
                  </Space>
                </Form>
                <Divider style={{ margin: '8px 0' }} />
              </>
            )}

            {/* Item cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {createPendingItems.map((item, i) => {
                const cat = (categories ?? []).find((c: ProductCategoryDto) => c.id === item.productCategoryId);
                return (
                  <Card
                    key={i}
                    size="small"
                    title={
                      <Space>
                        <Text strong>{item.productName}</Text>
                        <Tag>{t('orders.qty', { count: item.quantity })}</Tag>
                        {cat && <Tag color="blue">{cat.name}</Tag>}
                      </Space>
                    }
                    extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setCreatePendingItems((prev) => prev.filter((_, idx) => idx !== i))} />}
                  >
                    {item.notes && (
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.notes}</Text>
                    )}
                    {/* Per-item file upload */}
                    <div style={{ marginTop: 8 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('attachments.title')} ({(pendingFiles.get(i) ?? []).length}/10)
                      </Text>
                      <Upload
                        beforeUpload={(file) => {
                          if (file.size > 10 * 1024 * 1024) { message.error(t('attachments.fileTooLarge')); return false; }
                          setPendingFiles((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(i) ?? [];
                            if (existing.length >= 10) return prev;
                            next.set(i, [...existing, file]);
                            return next;
                          });
                          return false;
                        }}
                        showUploadList={false}
                        accept=".jpg,.jpeg,.png,.pdf"
                        multiple
                        disabled={(pendingFiles.get(i) ?? []).length >= 10}
                      >
                        <Button icon={<UploadOutlined />} size="small" disabled={(pendingFiles.get(i) ?? []).length >= 10} style={{ marginBottom: 8 }}>
                          {t('attachments.upload')}
                        </Button>
                      </Upload>
                      <List
                        size="small"
                        dataSource={pendingFiles.get(i) ?? []}
                        locale={{ emptyText: t('attachments.noAttachments') }}
                        renderItem={(file: File, fi: number) => (
                          <List.Item
                            style={{ padding: '4px 0' }}
                            actions={[
                              <Button key="preview" type="text" size="small" icon={<EyeOutlined />} onClick={() => openPendingPreview(file)} />,
                              <Button
                                key="delete"
                                type="text"
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => {
                                  setPendingFiles((prev) => {
                                    const next = new Map(prev);
                                    const existing = next.get(i) ?? [];
                                    next.set(i, existing.filter((_, idx) => idx !== fi));
                                    return next;
                                  });
                                }}
                              />,
                            ]}
                          >
                            <Space size={8}>
                              {file.type.startsWith('image/') ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  width={40} height={40}
                                  style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={() => openPendingPreview(file)}
                                  alt={file.name}
                                />
                              ) : (
                                <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                              )}
                              <div>
                                <Text ellipsis style={{ maxWidth: 200 }}>{file.name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                </Text>
                              </div>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Order-level Attachments section */}
            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('attachments.title')} ({(pendingFiles.get(-1) ?? []).length}/10)
            </Text>
            <Upload
              beforeUpload={(file) => {
                if (file.size > 10 * 1024 * 1024) {
                  message.error(t('attachments.fileTooLarge'));
                  return false;
                }
                setPendingFiles((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(-1) ?? [];
                  if (existing.length >= 10) return prev;
                  next.set(-1, [...existing, file]);
                  return next;
                });
                return false;
              }}
              showUploadList={false}
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              disabled={(pendingFiles.get(-1) ?? []).length >= 10}
            >
              <Button
                icon={<UploadOutlined />}
                disabled={(pendingFiles.get(-1) ?? []).length >= 10}
                size="small"
                style={{ marginBottom: 8 }}
              >
                {t('attachments.upload')}
              </Button>
            </Upload>
            <List
              size="small"
              dataSource={pendingFiles.get(-1) ?? []}
              locale={{ emptyText: t('attachments.noAttachments') }}
              renderItem={(file: File, index: number) => (
                <List.Item
                  style={{ padding: '4px 0' }}
                  actions={[
                    <Button key="preview" type="text" size="small" icon={<EyeOutlined />} onClick={() => openPendingPreview(file)} />,
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setPendingFiles((prev) => {
                        const next = new Map(prev);
                        const existing = next.get(-1) ?? [];
                        next.set(-1, existing.filter((_, i) => i !== index));
                        return next;
                      })}
                    />,
                  ]}
                >
                  <Space size={8}>
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        width={40} height={40}
                        style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => openPendingPreview(file)}
                        alt={file.name}
                      />
                    ) : (
                      <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                    )}
                    <div>
                      <Text ellipsis style={{ maxWidth: 200 }}>{file.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                      </Text>
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </>
        ) : detailLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : detailOrder ? (
          <>
            {/* ── DETAIL/EDIT MODE ── */}

            {/* Header: tags + action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
              <Space size={4} wrap>
                <Text style={{ color: orderTypeTextColors[detailOrder.orderType], fontWeight: 500 }}>
                  #{tEnum('OrderType', detailOrder.orderType)}
                </Text>
                <StatusText status={detailOrder.status} />
              </Space>
              {user?.role !== UserRole.SalesManager && (
                <Space size="small" wrap style={{ justifyContent: 'flex-end' }}>
                  {detailOrder.status === OrderStatus.Draft && (
                    <Button type="primary" size="small" loading={activateMutation.isPending || isSaving}
                      onClick={() => {
                        const hasPendingEdits = pendingItems.length > 0 || pendingItemRemovals.length > 0 || pendingComplexity.size > 0 || pendingSpecialRequestAdds.length > 0 || pendingSpecialRequestRemovals.length > 0;
                        const hasPendingAttachments = Array.from(attachmentRefsMap.current.values()).some((h) => h.hasPendingChanges());
                        const hasPendingPriority = localPriority != null && localPriority !== detailOrder.priority;
                        if (hasPendingEdits || hasPendingAttachments || hasPendingPriority) {
                          message.warning(t('orders.saveBeforeActivate'));
                          return;
                        }
                        if (detailOrder.items.length === 0) {
                          message.error(t('common:errors.NO_ITEMS'));
                          return;
                        }
                        if (detailOrder.priority <= 0) {
                          message.error(t('common:errors.PRIORITY_REQUIRED'));
                          return;
                        }
                        // Check if any processes were previously started (reactivation scenario)
                        const startedProcesses = detailOrder.items
                          .flatMap((item) => item.processes)
                          .filter((proc) => proc.startedAt || proc.totalDurationMinutes > 0);
                        if (startedProcesses.length > 0) {
                          // Show per-process reset/keep dialog
                          const processChoices: Record<string, boolean> = {};
                          startedProcesses.forEach((p) => { processChoices[p.id] = false; });
                          modal.confirm({
                            title: t('orders.reactivateTimerTitle'),
                            width: 500,
                            content: (
                              <div style={{ marginTop: 12 }}>
                                <p style={{ marginBottom: 12 }}>{t('orders.reactivateTimerDescription')}</p>
                                {startedProcesses.map((proc) => {
                                  const process = processMap.get(proc.processId);
                                  return (
                                    <div key={proc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                                      <span><b>{process?.code ?? '?'}</b> — {process?.name ?? proc.processId} ({formatDurationSec(proc.totalDurationMinutes)})</span>
                                      <Select
                                        size="small"
                                        defaultValue={false}
                                        style={{ width: 160 }}
                                        onChange={(val: boolean) => { processChoices[proc.id] = val; }}
                                        options={[
                                          { label: t('orders.keepTime'), value: false },
                                          { label: t('orders.resetTime'), value: true },
                                        ]}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ),
                            okText: t('orders.activateOrder'),
                            cancelText: t('common:actions.cancel'),
                            onOk: () => {
                              const resetIds = Object.entries(processChoices).filter(([, v]) => v).map(([k]) => k);
                              activateMutation.mutate({ id: detailOrder.id, resetProcessIds: resetIds.length > 0 ? resetIds : undefined }, {
                                onSuccess: () => message.success(t('orders.activatedSuccess')),
                                onError: (err) => message.error(getTranslatedError(err, t, t('orders.activateFailed'))),
                              });
                            },
                          });
                          return;
                        }
                        activateMutation.mutate({ id: detailOrder.id }, {
                          onSuccess: () => message.success(t('orders.activatedSuccess')),
                          onError: (err) => message.error(getTranslatedError(err, t, t('orders.activateFailed'))),
                        });
                      }}
                    >{t('orders.activateOrder')}</Button>
                  )}
                  {detailOrder.status === OrderStatus.Active && (
                    <Button size="small" onClick={() => {
                      pauseOrder.mutate(detailOrder.id, {
                        onSuccess: () => message.success(t('orders.pausedSuccess')),
                        onError: (err) => message.error(getTranslatedError(err, t, t('orders.pauseFailed'))),
                      });
                    }} loading={pauseOrder.isPending}>{t('orders.pauseOrder')}</Button>
                  )}
                  {detailOrder.status === OrderStatus.Paused && (
                    <Button size="small" onClick={() => {
                      resumeOrder.mutate(detailOrder.id, {
                        onSuccess: () => message.success(t('orders.resumedSuccess')),
                        onError: (err) => message.error(getTranslatedError(err, t, t('orders.resumeFailed'))),
                      });
                    }} loading={resumeOrder.isPending}>{t('orders.resumeOrder')}</Button>
                  )}
                  {detailOrder.status !== OrderStatus.Cancelled && detailOrder.status !== OrderStatus.Completed && (
                    <Popconfirm
                      title={t('orders.cancelConfirm')}
                      okText={t('common:actions.confirm')}
                      cancelText={t('common:actions.no')}
                      onConfirm={() => {
                        cancelOrder.mutate(detailOrder.id, {
                          onSuccess: () => message.success(t('orders.cancelledSuccess')),
                          onError: (err) => message.error(getTranslatedError(err, t, t('orders.cancelFailed'))),
                        });
                      }}
                    >
                      <Button size="small" danger loading={cancelOrder.isPending}>{t('orders.cancelOrder')}</Button>
                    </Popconfirm>
                  )}
                  {detailOrder.status === OrderStatus.Cancelled && (
                    <Popconfirm
                      title={t('orders.reopenConfirm')}
                      okText={t('common:actions.confirm')}
                      cancelText={t('common:actions.no')}
                      onConfirm={() => {
                        reopenOrder.mutate(detailOrder.id, {
                          onSuccess: () => message.success(t('orders.reopenedSuccess')),
                          onError: (err) => message.error(getTranslatedError(err, t, t('orders.reopenFailed'))),
                        });
                      }}
                    >
                      <Button size="small" type="primary" loading={reopenOrder.isPending} icon={<UndoOutlined />}>{t('orders.reopenOrder')}</Button>
                    </Popconfirm>
                  )}
                  <Button size="small" icon={<CopyOutlined />} onClick={() => {
                    const maxPriority = (masterResult?.items ?? []).reduce((max, o) => Math.max(max, o.priority), 0);
                    form.resetFields();
                    form.setFieldsValue({
                      orderType: detailOrder.orderType,
                      deliveryDate: dayjs(detailOrder.deliveryDate),
                      priority: maxPriority + 10,
                    });
                    setCreatePendingItems(detailOrder.items.map((item) => ({
                      productCategoryId: item.productCategoryId,
                      productName: item.productName,
                      quantity: item.quantity,
                      notes: item.notes ?? undefined,
                    })));
                    setDetailOrderId(null);
                    setIsCreating(true);
                  }}>{t('orders.duplicate')}</Button>
                </Space>
              )}
            </div>

            {/* A) Stats Row */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{t('common:labels.priority')}</Text>
                  <Space size={4}>
                    <InputNumber
                      min={1}
                      max={100000}
                      precision={0}
                      value={localPriority}
                      style={{ width: 80 }}
                      disabled={detailOrder.status === OrderStatus.Cancelled || detailOrder.status === OrderStatus.Completed}
                      onChange={(val) => {
                        if (val != null) setLocalPriority(val);
                      }}
                      onPressEnter={() => {
                        if (localPriority != null && localPriority !== detailOrder.priority) {
                          changePriorityMutation.mutate(
                            { id: detailOrder.id, priority: localPriority },
                            {
                              onSuccess: () => message.success(t('orders.priorityChanged')),
                              onError: (err) => message.error(getTranslatedError(err, t, t('orders.priorityChangeFailed'))),
                            },
                          );
                        }
                      }}
                    />
                  </Space>
                </div>
              </Col>
              <Col span={8}>
                <div>
                  <div style={{ color: '#00000073', fontSize: 14, marginBottom: 4 }}>{t('common:labels.deliveryDate')}</div>
                  {editingDeliveryDate ? (
                    <Space size={4}>
                      <DatePicker
                        size="small"
                        value={deliveryDateDraft}
                        format="DD.MM.YYYY."
                        autoFocus
                        onChange={(d) => setDeliveryDateDraft(d)}
                      />
                      <Button size="small" type="primary" loading={savingInline} icon={<CheckOutlined />} onClick={saveInlineDeliveryDate} />
                      <Button size="small" icon={<CloseCircleOutlined />} onClick={() => { setDeliveryDateDraft(dayjs(detailOrder.deliveryDate)); setEditingDeliveryDate(false); }} />
                    </Space>
                  ) : (
                    <Space size={4}>
                      <span style={{ color: deliveryDateColor, fontSize: 20, fontWeight: 500 }}>
                        {dayjs(detailOrder.deliveryDate).format('DD.MM.YYYY.')}
                      </span>
                      {detailOrder.status !== OrderStatus.Completed && detailOrder.status !== OrderStatus.Cancelled && user?.role !== UserRole.SalesManager && (
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditingDeliveryDate(true)} />
                      )}
                    </Space>
                  )}
                </div>
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('orders.completion')}
                  value={detailCompletion.percent}
                  suffix="%"
                  valueStyle={{ color: detailCompletion.percent === 100 ? '#92D050' : undefined, fontSize: 20 }}
                />
              </Col>
            </Row>

            {/* B) Process Timeline */}
            {processes && processes.length > 0 && detailOrder.items.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                  {t('orders.processFlow')}
                </Text>
                <ProcessTimeline order={detailOrder} processes={processes} tEnum={tEnum} processDependencies={detailDeps} />
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* C) Item Cards */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('orders.items', { count: detailOrder.items.length })}
              </Title>
              {detailOrder.status === OrderStatus.Draft && !addingItem && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingItem(true)}>
                  {t('orders.addItem')}
                </Button>
              )}
            </div>

            {/* Add Item form — component={false} prevents nested <form> tag */}
            {addingItem && (
              <>
                <Form form={itemForm} component={false} onFinish={(values) => {
                  const itemIndex = pendingItems.length;
                  if (currentDraftItemFiles.length > 0) {
                    setPendingNewItemFiles((prev) => {
                      const next = new Map(prev);
                      next.set(itemIndex, currentDraftItemFiles);
                      return next;
                    });
                  }
                  setCurrentDraftItemFiles([]);
                  setPendingItems((prev) => [...prev, values as AddOrderItemRequest]);
                  itemForm.resetFields();
                  setAddingItem(false);
                }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="productCategoryId" label={t('orders.productCategory')} rules={[{ required: true }]}>
                        <Select
                          showSearch
                          popupMatchSelectWidth={false}
                          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                          options={(categories ?? []).map((c: ProductCategoryDto) => ({ label: c.name, value: c.id }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="productName" label={t('orders.productName')}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="quantity" label={t('orders.quantity')} rules={[{ required: true, message: t('common:errors.INVALID_QUANTITY') }, { type: 'number', min: 1, message: t('common:errors.INVALID_QUANTITY') }]}>
                        <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="notes" label={t('common:labels.notes')}>
                        <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label={`${t('attachments.title')} (${currentDraftItemFiles.length}/10)`}>
                    <Upload
                      beforeUpload={(file) => {
                        if (file.size > 10 * 1024 * 1024) { message.error(t('attachments.fileTooLarge')); return false; }
                        setCurrentDraftItemFiles((prev) => prev.length >= 10 ? prev : [...prev, file]);
                        return false;
                      }}
                      showUploadList={false}
                      accept=".jpg,.jpeg,.png,.pdf"
                      multiple
                      disabled={currentDraftItemFiles.length >= 10}
                    >
                      <Button icon={<UploadOutlined />} size="small" disabled={currentDraftItemFiles.length >= 10}>
                        {t('attachments.upload')}
                      </Button>
                    </Upload>
                    {currentDraftItemFiles.length > 0 && (
                      <List
                        size="small"
                        style={{ marginTop: 8 }}
                        dataSource={currentDraftItemFiles}
                        renderItem={(file: File, fi: number) => (
                          <List.Item
                            style={{ padding: '4px 0' }}
                            actions={[
                              <Button key="preview" type="text" size="small" icon={<EyeOutlined />} onClick={() => openPendingPreview(file)} />,
                              <Button key="delete" type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => setCurrentDraftItemFiles((prev) => prev.filter((_, idx) => idx !== fi))} />,
                            ]}
                          >
                            <Space size={8}>
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => openPendingPreview(file)} alt={file.name} />
                              ) : (
                                <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                              )}
                              <div>
                                <Text ellipsis style={{ maxWidth: 200 }}>{file.name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                </Text>
                              </div>
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </Form.Item>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" onClick={() => itemForm.submit()}>{t('orders.addItem')}</Button>
                    <Button onClick={() => { setAddingItem(false); setCurrentDraftItemFiles([]); }}>{t('common:actions.cancel')}</Button>
                  </Space>
                </Form>
                <Divider style={{ margin: '8px 0' }} />
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detailOrder.items.map((item: OrderItemDto) => {
                const isRemoved = pendingItemRemovals.includes(item.id);
                const isDraft = detailOrder.status === OrderStatus.Draft;
                return (
                  <Card
                    key={item.id}
                    size="small"
                    style={{ ...(isRemoved ? { opacity: 0.4 } : {}) }}
                    title={
                      <Space>
                        <Text strong style={isRemoved ? { textDecoration: 'line-through' } : undefined}>{item.productName}</Text>
                        <Tag>{t('orders.qty', { count: item.quantity })}</Tag>
                        {(() => { const cat = (categories ?? []).find((c: ProductCategoryDto) => c.id === item.productCategoryId); return cat ? <Tag color="blue">{cat.name}</Tag> : null; })()}
                      </Space>
                    }
                    extra={isDraft && (
                      isRemoved ? (
                        <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => setPendingItemRemovals((prev) => prev.filter((id) => id !== item.id))} />
                      ) : (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setPendingItemRemovals((prev) => [...prev, item.id])} />
                      )
                    )}
                  >
                    <ItemProcessBar
                      item={item} processMap={processMap} tEnum={tEnum}
                      processDependencies={detailDeps}
                      canRestart={(detailOrder.status === OrderStatus.Active || detailOrder.status === OrderStatus.Completed) && user?.role !== UserRole.SalesManager}
                      onRestart={async (oipId, resetTime) => {
                        try {
                          await processWorkflowApi.restart(oipId, { resetTime });
                          message.success(t('orders.processRestarted'));
                          queryClient.invalidateQueries({ queryKey: ['orders', detailOrder.id] });
                          queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
                        } catch (err) {
                          message.error(getTranslatedError(err, t, t('orders.processRestartFailed')));
                        }
                      }}
                    />

                    {/* Special Requests */}
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{t('orders.specialRequests')}: </Text>
                      {item.specialRequests.length > 0 ? (
                        item.specialRequests.map((sr) => {
                          const srt = srtMap.get(sr.specialRequestTypeId);
                          const isPendingRemoval = pendingSpecialRequestRemovals.some((r) => r.specialRequestId === sr.id);
                          return (
                            <Tag
                              key={sr.id}
                              color={isPendingRemoval ? undefined : 'purple'}
                              closable={isDraft && !isPendingRemoval}
                              onClose={(e) => {
                                e.preventDefault();
                                setPendingSpecialRequestRemovals((prev) => [...prev, { itemId: item.id, specialRequestId: sr.id }]);
                              }}
                              style={{ marginBottom: 2, textDecoration: isPendingRemoval ? 'line-through' : undefined, opacity: isPendingRemoval ? 0.5 : undefined }}
                            >
                              {srt ? srt.name : sr.specialRequestTypeId.slice(0, 8)}
                            </Tag>
                          );
                        })
                      ) : pendingSpecialRequestAdds.filter((a) => a.itemId === item.id).length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                      ) : null}
                      {pendingSpecialRequestAdds.filter((a) => a.itemId === item.id).map((a, i) => {
                        const srt = srtMap.get(a.specialRequestTypeId);
                        return (
                          <Tag
                            key={`pending-sr-${i}`}
                            color="purple"
                            closable
                            onClose={(e) => {
                              e.preventDefault();
                              setPendingSpecialRequestAdds((prev) => prev.filter((p) => !(p.itemId === a.itemId && p.specialRequestTypeId === a.specialRequestTypeId)));
                            }}
                            style={{ marginBottom: 2, borderStyle: 'dashed' }}
                          >
                            {srt ? srt.name : a.specialRequestTypeId.slice(0, 8)}
                          </Tag>
                        );
                      })}
                      {isDraft && (
                        <Select
                          size="small"
                          placeholder={`+ ${t('common:actions.add')}`}
                          style={{ width: 140, marginLeft: 4 }}
                          value={undefined}
                          options={(specialRequestTypes ?? [])
                            .filter((srt) => srt.isActive
                              && !item.specialRequests.some((sr) => sr.specialRequestTypeId === srt.id && !pendingSpecialRequestRemovals.some((r) => r.specialRequestId === sr.id))
                              && !pendingSpecialRequestAdds.some((a) => a.itemId === item.id && a.specialRequestTypeId === srt.id))
                            .map((srt) => ({ label: srt.name, value: srt.id }))}
                          onChange={(val) => {
                            if (val) {
                              setPendingSpecialRequestAdds((prev) => [...prev, { itemId: item.id, specialRequestTypeId: val }]);
                            }
                          }}
                        />
                      )}
                    </div>

                    {/* Complexity overrides */}
                    {detailOrder.status !== OrderStatus.Cancelled && item.processes.filter((p) => p.status !== ProcessStatus.Withdrawn).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>{t('orders.complexityOverrides')}:</Text>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[...item.processes]
                            .filter((p) => p.status !== ProcessStatus.Withdrawn)
                            .sort((a, b) => {
                              const pa = processMap.get(a.processId);
                              const pb = processMap.get(b.processId);
                              return (pa?.sequenceOrder ?? 0) - (pb?.sequenceOrder ?? 0);
                            })
                            .map((proc) => {
                              const process = processMap.get(proc.processId);
                              const pendingKey = `${item.id}:${proc.id}`;
                              const pendingVal = pendingComplexity.get(pendingKey);
                              const displayVal = pendingVal ?? proc.complexity;
                              return (
                                <Tooltip key={proc.id} title={process?.name ?? proc.processId}>
                                  <Select
                                    size="small"
                                    value={displayVal}
                                    placeholder={process?.code ?? '?'}
                                    allowClear
                                    disabled={!isDraft}
                                    style={{ width: 100, ...(pendingVal ? { borderColor: '#1677ff' } : {}) }}
                                    popupMatchSelectWidth={false}
                                    options={Object.values(ComplexityType).map((c) => ({
                                      label: `${process?.code ?? '?'} ${tEnum('ComplexityType', c)}`,
                                      value: c,
                                    }))}
                                    onChange={(val) => {
                                      if (val) {
                                        setPendingComplexity((prev) => {
                                          const next = new Map(prev);
                                          if (val === proc.complexity) {
                                            next.delete(pendingKey);
                                          } else {
                                            next.set(pendingKey, val);
                                          }
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                </Tooltip>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {item.notes && (
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                        {item.notes}
                      </Text>
                    )}
                    <OrderAttachments orderId={detailOrder.id} orderItemId={item.id} attachments={item.attachments ?? []} readOnly={!isDraft} ref={(handle) => { if (handle) attachmentRefsMap.current.set(item.id, handle); else attachmentRefsMap.current.delete(item.id); }} />
                  </Card>
                );
              })}

              {/* Pending new items */}
              {pendingItems.map((item, i) => {
                const cat = (categories ?? []).find((c: ProductCategoryDto) => c.id === item.productCategoryId);
                const files = pendingNewItemFiles.get(i) ?? [];
                return (
                  <Card
                    key={`pending-${i}`}
                    size="small"
                    style={{ borderStyle: 'dashed', borderColor: '#1677ff' }}
                    title={
                      <Space>
                        <Text strong>{item.productName}</Text>
                        <Tag>{t('orders.qty', { count: item.quantity })}</Tag>
                        {cat && <Tag color="blue">{cat.name}</Tag>}
                        <Tag color="orange">{t('orders.pending')}</Tag>
                      </Space>
                    }
                    extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => { setPendingItems((prev) => prev.filter((_, idx) => idx !== i)); setPendingNewItemFiles((prev) => { const m = new Map(prev); m.delete(i); return m; }); }} />}
                  >
                    {item.notes && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: files.length > 0 ? 8 : 0 }}>{item.notes}</Text>
                    )}
                    {files.length > 0 && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('orders.attachments')} ({files.length}):</Text>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {files.map((f, fi) => (
                            <Tag key={fi} style={{ margin: 0 }}>{f.name}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* D) Notes & Settings */}
            {detailOrder.status === OrderStatus.Draft ? (
              <Form form={editForm} layout="vertical" style={{ marginTop: 20 }} onValuesChange={onEditValuesChange}>
                <Form.Item name="notes" label={t('common:labels.notes')} style={{ marginBottom: 12 }}>
                  <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="customWarningDays" label={t('orders.warningDays')} style={{ marginBottom: 0 }}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="customCriticalDays" label={t('orders.criticalDays')} style={{ marginBottom: 0 }}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            ) : detailOrder.notes ? (
              <div style={{ marginTop: 20 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {t('common:labels.notes')}
                </Text>
                <Text>{detailOrder.notes}</Text>
              </div>
            ) : null}

            {/* D2) Related Requests */}
            {((detailBlockRequests && detailBlockRequests.length > 0) || (detailChangeRequests && detailChangeRequests.length > 0)) && (
              <div style={{ marginTop: 20 }}>
                {detailBlockRequests && detailBlockRequests.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      {t('blockRequests.title')} ({detailBlockRequests.length})
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailBlockRequests.map((br) => (
                        <div key={br.id} style={{ padding: 8, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span><Tag color={br.status === 'Pending' ? 'orange' : br.status === 'Approved' ? 'red' : 'default'}>{tEnum('RequestStatus', br.status)}</Tag>{br.processName && <Text type="secondary" style={{ marginLeft: 4 }}>· {br.processName}</Text>}</span>
                            <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(br.createdAt).format('DD.MM.YYYY. HH:mm')}</Text>
                          </div>
                          {br.requestNote && <div><Text type="secondary" style={{ fontSize: 11 }}>{t('blockRequests.requestNote')}:</Text> <span style={{ whiteSpace: 'pre-wrap' }}>{br.requestNote}</span></div>}
                          {br.blockReason && <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>{t('blockRequests.blockReason')}:</Text> {br.blockReason}</div>}
                          {br.rejectionNote && <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>{t('blockRequests.response')}:</Text> {br.rejectionNote}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detailChangeRequests && detailChangeRequests.length > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      {t('changeRequests.title')} ({detailChangeRequests.length})
                    </Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {detailChangeRequests.map((cr) => (
                        <div key={cr.id} style={{ padding: 8, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span><Tag color={cr.status === 'Pending' ? 'orange' : cr.status === 'Approved' ? 'green' : 'default'}>{tEnum('RequestStatus', cr.status)}</Tag></span>
                            <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(cr.createdAt).format('DD.MM.YYYY. HH:mm')}</Text>
                          </div>
                          {cr.description && <div style={{ whiteSpace: 'pre-wrap' }}>{cr.description}</div>}
                          {cr.responseNote && <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>{t('changeRequests.responseNote')}:</Text> {cr.responseNote}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* E) Attachments — inline, same pattern as create mode */}
            <OrderAttachments orderId={detailOrder.id} attachments={detailOrder.attachments ?? []} readOnly={detailOrder.status !== OrderStatus.Draft} ref={(handle) => { if (handle) attachmentRefsMap.current.set('order', handle); else attachmentRefsMap.current.delete('order'); }} />
          </>
        ) : (
          <Typography.Text>{t('orders.orderNotFound')}</Typography.Text>
        )}
      </Drawer>

      {/* Pending file preview modal */}
      <Modal
        open={!!pendingPreview}
        onCancel={() => {
          if (pendingPreview) URL.revokeObjectURL(pendingPreview.split('#')[0]);
          setPendingPreview(null);
        }}
        footer={null}
        width="80vw"
        style={{ top: 20 }}
        destroyOnHidden
      >
        {pendingPreview && pendingPreviewType === 'image' && (
          <img src={pendingPreview} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} alt="Preview" />
        )}
        {pendingPreview && pendingPreviewType === 'pdf' && (
          <iframe src={pendingPreview} style={{ width: '100%', height: '80vh', border: 'none' }} title="PDF Preview" />
        )}
      </Modal>
    </div>
  );
}
