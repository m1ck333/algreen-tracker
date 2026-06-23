import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Table, Button, Space, Select, Tag, Drawer, Form, Input,
  InputNumber, DatePicker, App, Row, Col, Spin, Popconfirm, Divider,
  Tooltip, Progress, Statistic, Upload, List, Modal, Card, Popover, Checkbox, theme,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined, PaperClipOutlined, UndoOutlined, UploadOutlined, CloseCircleOutlined, FilePdfOutlined, EyeOutlined, CopyOutlined, FullscreenOutlined, FullscreenExitOutlined, QuestionCircleOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@alblue/auth';
import { OrderStatus, OrderType, ProcessStatus, ComplexityType, UserRole } from '@alblue/shared-types';
import type { OrderMasterViewDto, OrderItemDto, ProcessDto, ProductCategoryDto, SpecialRequestTypeDto, AddOrderItemRequest, OrderTypeDto, ManualProcessInput, ManualDependencyInput } from '@alblue/shared-types';
import {
  useCreateOrder, useOrder, useActivateOrder,
  useUpdateOrder, useCancelOrder, usePauseOrder, useResumeOrder, useReopenOrder,
} from '../../hooks/useOrders';
import { productCategoriesApi, processesApi, ordersApi, specialRequestTypesApi, processWorkflowApi, blockRequestsApi, changeRequestsApi, orderTypesApi } from '@alblue/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../components/StatusBadge';
import { OrderAttachments, type OrderAttachmentsHandle } from '../../components/OrderAttachments';
import { compressFile } from '../../utils/compressImage';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import { useLayoutStore } from '../../stores/layout-store';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { PageHeader } from '../../components/PageHeader';
import { getTranslatedError } from '../../utils/errors';
import { useSignalREvent, SignalREvents } from '@alblue/signalr-client';
import {
  processStatusColors,
  orderTypeColors,
  orderTypeTextColors,
  orderStatusTextColors,
  READY_BORDER_COLOR,
  getCompletionInfo,
  getDeadlineLevel,
  formatDurationSec,
} from './orderListHelpers';
import { ProcessCell } from './ProcessCell';
import { StatusText } from './StatusText';
import { ProcessTimeline } from './ProcessTimeline';
import { ItemProcessBar } from './ItemProcessBar';
import { useFixedColumn } from '../../hooks/useFixedColumn';
import { useFilterWidth } from '../../hooks/useFilterWidth';

const { Title, Text } = Typography;

const ATTACHMENT_RECOVERY = import.meta.env.VITE_ATTACHMENT_RECOVERY === 'true';

// ─── Main Component ──────────────────────────────────────

export function OrderListPage() {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.tenantId);
  const { token } = theme.useToken();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | undefined>(undefined);
  const [isInvoicedFilter, setIsInvoicedFilter] = useState<boolean | undefined>(undefined);
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

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, orderTypeFilter, isInvoicedFilter, dateFrom, dateTo]);

  const { data: masterResult, isLoading } = useQuery({
    queryKey: ['orders-master-view', tenantId, statusFilter, orderTypeFilter, isInvoicedFilter, debouncedSearch, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => ordersApi.getMasterView({
      status: statusFilter,
      orderType: orderTypeFilter,
      isInvoiced: isInvoicedFilter,
      search: debouncedSearch || undefined,
      dateFrom: dateFrom?.format('YYYY-MM-DD'),
      dateTo: dateTo?.format('YYYY-MM-DD'),
      page,
      pageSize,
      sortBy,
      sortDirection,
    }).then((r) => r.data),
    enabled: !!tenantId,
    // SignalR push handles most order-state changes within ~1s. Polling is
    // the safety net for missed events (hub reconnect, etc.).
    refetchInterval: 120_000,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(() => searchParams.get('detail'));

  // Open the drawer whenever ?detail=<id> appears in the URL, then strip the
  // param so the URL stays clean. Runs on mount AND on every later URL change,
  // so clicking a notification while already on /orders also works (the
  // useState initializer above only fires once).
  useEffect(() => {
    const detail = searchParams.get('detail');
    if (detail) {
      setDetailOrderId(detail);
      searchParams.delete('detail');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
  const { guardedClose: guardedEditClose, onValuesChange: onEditValuesChange, markClean: markEditClean } = useUnsavedChanges(!!detailOrderId);
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
  // Fetch the master-view row for this order so the drawer can reuse the
  // BE-computed processStatuses / processReady / processPaused / processDependencies
  // instead of recomputing on the FE. Re-doing readiness on the FE was buggy
  // for multi-item orders with different categories — the flattened deps dict
  // cross-pollinated edges between items. BE already does this correctly
  // per-item; we just trust the row.
  const { data: detailMasterRow } = useQuery({
    queryKey: ['order-detail-master-row', tenantId, detailOrderId],
    queryFn: () =>
      ordersApi.getMasterView({ search: detailOrder!.orderNumber, page: 1, pageSize: 50 }).then((r) => {
        return r.data.items.find((o) => o.id === detailOrderId) ?? null;
      }),
    enabled: !!tenantId && !!detailOrderId && !!detailOrder,
    staleTime: 5_000,
    // SignalR push (above) refreshes this within ~1s of any process state
    // change. Polling stays as a safety net.
    refetchInterval: 60_000,
  });


  // Fetch block & change requests for the detail order
  const { data: detailBlockRequests } = useQuery({
    queryKey: ['order-detail-block-requests', tenantId, detailOrderId],
    queryFn: () => blockRequestsApi.getAll({ orderId: detailOrderId!, pageSize: 50 }).then((r) => r.data.items),
    enabled: !!tenantId && !!detailOrderId,
    staleTime: 10_000,
  });
  const { data: detailChangeRequests } = useQuery({
    queryKey: ['order-detail-change-requests', tenantId, detailOrderId],
    queryFn: () => changeRequestsApi.getAll({ orderId: detailOrderId!, pageSize: 50 }).then((r) => r.data.items),
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
    queryFn: () => productCategoriesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });
  const { data: specialRequestTypes } = useQuery({
    queryKey: ['special-request-types', tenantId],
    queryFn: () => specialRequestTypesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
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
    queryFn: () => processesApi.getAll({ pageSize: 100 }).then((r) =>
      [...r.data.items].sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    ),
    enabled: !!tenantId,
  });

  // Order types — used to gate the manual-processes section in create/edit drawer.
  // Each enum value (Standard/Repair/...) maps to an OrderTypeDto by Code, and
  // each type carries an `allowsManualProcesses` flag the admin toggles.
  const { data: orderTypes } = useQuery({
    queryKey: ['order-types', tenantId, 'active'],
    queryFn: () => orderTypesApi.getAll({ isActive: true, pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });
  const orderTypeByCode = useMemo(() => {
    const map = new Map<string, OrderTypeDto>();
    (orderTypes ?? []).forEach((ot) => map.set(ot.code.toUpperCase(), ot));
    return map;
  }, [orderTypes]);

  // Watch the create-form's orderType field so we can render the manual-process
  // section conditionally when the matched OrderType has allowsManualProcesses=true.
  const watchedOrderType = Form.useWatch('orderType', form) as OrderType | undefined;
  const watchedOrderTypeMeta = watchedOrderType
    ? orderTypeByCode.get(String(watchedOrderType).toUpperCase())
    : undefined;

  // Manual process picker state — used only when watchedOrderTypeMeta.allowsManualProcesses
  // is true. Sequence is the position in `manualProcessIds`. Reset whenever the
  // selected order type stops allowing manual processes.
  const [manualProcessIds, setManualProcessIds] = useState<string[]>([]);
  const [manualComplexity, setManualComplexity] = useState<Record<string, ComplexityType | undefined>>({});
  const [manualDeps, setManualDeps] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!watchedOrderTypeMeta?.allowsManualProcesses) {
      setManualProcessIds([]);
      setManualComplexity({});
      setManualDeps({});
    }
  }, [watchedOrderTypeMeta?.allowsManualProcesses]);
  // Drop dangling deps when a process is removed from the manual list.
  useEffect(() => {
    setManualDeps((prev) => {
      const next: Record<string, string[]> = {};
      for (const pid of manualProcessIds) {
        next[pid] = (prev[pid] ?? []).filter((d) => manualProcessIds.includes(d) && d !== pid);
      }
      return next;
    });
  }, [manualProcessIds]);

  // Process lookup map
  const processMap = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    (processes ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [processes]);

  // ─── Export ──────────────────────────────────────────────
  const exportColumns: ExportColumn<OrderMasterViewDto>[] = useMemo(() => {
    const baseCols: ExportColumn<OrderMasterViewDto>[] = [
      { header: t('common:labels.orderNumber'), value: (o) => o.orderNumber, width: 16 },
      {
        header: t('common:labels.type'),
        value: (o) => orderTypeByCode.get(String(o.orderType).toUpperCase())?.name ?? tEnum('OrderType', o.orderType),
        cell: (o) => ({ fillColor: orderTypeColors[o.orderType] === 'blue' ? '#E6F4FF' : orderTypeColors[o.orderType] === 'orange' ? '#FFF4E6' : orderTypeColors[o.orderType] === 'red' ? '#FFE6E6' : '#F4E6FF' }),
        width: 14,
      },
      {
        header: t('common:labels.status'),
        value: (o) => tEnum('OrderStatus', o.status),
        cell: (o) => ({ fontColor: orderStatusTextColors[o.status]?.replace('#', ''), bold: true }),
        width: 14,
      },
      {
        header: t('common:labels.deliveryDate'),
        value: (o) => (o.deliveryDate ? new Date(o.deliveryDate) : null),
        width: 16,
      },
      { header: t('common:labels.priority'), value: (o) => o.priority, align: 'right', width: 10 },
      {
        header: t('orders.export.progress'),
        value: (o) => `${o.completedProcesses}/${o.totalProcesses}`,
        align: 'center',
        width: 12,
      },
      {
        header: t('orders.export.invoiced'),
        value: (o) => (o.isInvoiced ? t('common:actions.yes') : t('common:actions.no')),
        align: 'center',
        width: 12,
      },
      {
        header: t('common:labels.created'),
        value: (o) => (o.createdAt ? new Date(o.createdAt) : null),
        width: 18,
      },
      {
        header: t('common:labels.completed'),
        value: (o) => (o.completedAt ? new Date(o.completedAt) : null),
        width: 18,
      },
    ];
    const procCols: ExportColumn<OrderMasterViewDto>[] = (processes ?? [])
      .slice()
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((proc) => ({
        header: `${proc.code} — ${proc.name}`,
        value: (o) => {
          const status = o.processStatuses[proc.id];
          return status ? tEnum('ProcessStatus', status) : '';
        },
        cell: (o) => {
          const status = o.processStatuses[proc.id] as ProcessStatus | undefined;
          if (!status) return undefined;
          const isPaused = o.processPaused[proc.id];
          const fill = isPaused ? '#FFAA00' : processStatusColors[status];
          // White text for dark fills (Blocked red, InProgress blue), dark for light fills
          const dark = status === ProcessStatus.Blocked || status === ProcessStatus.InProgress;
          return { fillColor: fill, fontColor: dark ? '#FFFFFF' : '#1F1F1F', bold: status === ProcessStatus.Blocked };
        },
        align: 'center',
        width: 14,
      }));
    return [...baseCols, ...procCols];
  }, [processes, t, tEnum]);

  const exportFilters: Array<{ label: string; value: string }> = useMemo(() => {
    const filters: Array<{ label: string; value: string }> = [];
    if (debouncedSearch) filters.push({ label: t('export.search'), value: debouncedSearch });
    if (statusFilter) filters.push({ label: t('export.status'), value: tEnum('OrderStatus', statusFilter) });
    if (orderTypeFilter) filters.push({ label: t('export.type'), value: tEnum('OrderType', orderTypeFilter) });
    if (isInvoicedFilter !== undefined) filters.push({ label: t('orders.invoiced'), value: isInvoicedFilter ? t('common:actions.yes') : t('common:actions.no') });
    if (dateFrom) filters.push({ label: t('export.dateFrom'), value: dateFrom.format('DD.MM.YYYY.') });
    if (dateTo) filters.push({ label: t('export.dateTo'), value: dateTo.format('DD.MM.YYYY.') });
    return filters;
  }, [debouncedSearch, statusFilter, orderTypeFilter, isInvoicedFilter, dateFrom, dateTo, t, tEnum]);

  const fetchAllOrders = async (): Promise<OrderMasterViewDto[]> => {
    const { data } = await ordersApi.getMasterView({
      status: statusFilter,
      orderType: orderTypeFilter,
      isInvoiced: isInvoicedFilter,
      search: debouncedSearch || undefined,
      dateFrom: dateFrom?.format('YYYY-MM-DD'),
      dateTo: dateTo?.format('YYYY-MM-DD'),
      page: 1,
      pageSize: 10000,
      sortBy,
      sortDirection,
    });
    return data.items;
  };

  const queryClient = useQueryClient();

  // SignalR push: refresh the order list + open-detail row whenever an event
  // changes order/process state somewhere in the system. Each handler is a
  // single cache invalidation — the underlying queries refetch with the
  // user's current filters/sort/page.
  const invalidateOrderViews = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
    queryClient.invalidateQueries({ queryKey: ['order-detail-master-row'] });
  }, [queryClient]);
  useSignalREvent(SignalREvents.OrderActivated, invalidateOrderViews);
  useSignalREvent(SignalREvents.OrderUpdated, invalidateOrderViews);
  useSignalREvent(SignalREvents.ProcessStarted, invalidateOrderViews);
  useSignalREvent(SignalREvents.ProcessCompleted, invalidateOrderViews);
  useSignalREvent(SignalREvents.ProcessBlocked, invalidateOrderViews);
  useSignalREvent(SignalREvents.ProcessUnblocked, invalidateOrderViews);

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

  const changePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) => ordersApi.changePriority(id, priority),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.id] });
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
      markEditClean();
    } catch (err) {
      message.error(getTranslatedError(err, t, t('orders.updateFailed')));
    } finally {
      setSavingInline(false);
    }
  }, [detailOrder, orderNumberDraft, updateOrder, queryClient, t, message, markEditClean]);

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
      markEditClean();
    } catch (err) {
      message.error(getTranslatedError(err, t, t('orders.updateFailed')));
    } finally {
      setSavingInline(false);
    }
  }, [detailOrder, deliveryDateDraft, updateOrder, queryClient, t, message, markEditClean]);

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
    user?.role === UserRole.Admin ||
    user?.role === UserRole.SuperAdmin;

  const onCreateFinish = async (values: Record<string, unknown>) => {
    // Empty-order guard (Milos 16.06.2026): without this it's possible to
    // hit Save with no items and no manual processes added, which produces
    // an empty order header — useless and confusing on the drawer.
    // OrderTypes with AllowsManualProcesses=true are intentionally exempted
    // when at least one manual process is picked, so the "rework" / "complaint"
    // flow (where items may come later) isn't blocked.
    const hasItems = createPendingItems.length > 0;
    const hasManualProcesses =
      !!watchedOrderTypeMeta?.allowsManualProcesses && manualProcessIds.length > 0;
    if (!hasItems && !hasManualProcesses) {
      message.error(t('orders.emptyOrderError'));
      return;
    }
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
      // Build manual processes payload only when the picked order type allows it.
      const manualProcessesPayload: ManualProcessInput[] | undefined =
        watchedOrderTypeMeta?.allowsManualProcesses && manualProcessIds.length > 0
          ? manualProcessIds.map((pid, i) => ({
              processId: pid,
              sequenceOrder: i + 1,
              defaultComplexity: manualComplexity[pid],
            }))
          : undefined;
      const manualDependenciesPayload: ManualDependencyInput[] | undefined =
        watchedOrderTypeMeta?.allowsManualProcesses && manualProcessIds.length > 0
          ? Object.entries(manualDeps).flatMap(([pid, deps]) =>
              deps.map((d) => ({ processId: pid, dependsOnProcessId: d })),
            )
          : undefined;

      await createOrder.mutateAsync({
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
        manualProcesses: manualProcessesPayload,
        manualDependencies: manualDependenciesPayload && manualDependenciesPayload.length > 0 ? manualDependenciesPayload : undefined,
      });
      message.success(t('orders.createdSuccess'));
      form.resetFields();
      setCreatePendingItems([]);
      setPendingFiles(new Map());
      setAddingItem(false);
      setIsCreating(false);
      setManualProcessIds([]);
      setManualComplexity({});
      setManualDeps({});
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
        fixed: fixedCol('left'),
        sorter: true,
        sortOrder: sortBy === 'priority' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
      },
      {
        title: t('orders.orderNumber'),
        dataIndex: 'orderNumber',
        width: 160,
        fixed: fixedCol('left'),
        sorter: true,
        sortOrder: sortBy === 'orderNumber' ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null,
        render: (text: string, record: OrderMasterViewDto) => (
          <Space size={4}>
            <span style={{ fontWeight: 500 }}>{text}</span>
            {record.attachmentCount > 0 && (
              <Tooltip title={`${record.attachmentCount} ${record.attachmentCount === 1 ? 'dokument' : 'dokumenata'}`}>
                <PaperClipOutlined style={{ color: token.colorPrimary, fontSize: 13 }} />
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
          <Tag color={orderTypeColors[type]}>
            {orderTypeByCode.get(String(type).toUpperCase())?.name ?? tEnum('OrderType', type)}
          </Tag>
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
        // "Ready" comes from BE `processReady` (per-item check) — aggregated
        // processStatuses can't tell that one item is ready while a sibling is
        // mid-pipeline. Sequential fallback (no dep system at all) stays here
        // since BE returns processReady=false in that case.
        let isReady = (record.processReady?.[proc.id] ?? false) && record.status === OrderStatus.Active;
        if (!isReady && status === ProcessStatus.Pending && record.status === OrderStatus.Active) {
          const allDeps = record.processDependencies ?? {};
          const hasDependencySystem = Object.keys(allDeps).length > 0;
          if (!hasDependencySystem) {
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
      <PageHeader
        title={t('orders.title')}
        actions={<><Popover
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
                  { color: '#BFBFBF', label: t('orders.legend.pending') },
                ].map((entry) => (
                  <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 18, height: 18, background: entry.color, border: '1px solid #ccc', display: 'inline-block' }} />
                    <span>{entry.label}</span>
                  </div>
                ))}
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, background: 'transparent', border: `1px dashed ${token.colorBorderSecondary}`, display: 'inline-block' }} />
                  <span>{t('orders.legend.notApplicable')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 18, background: '#BFBFBF', border: `3px solid ${READY_BORDER_COLOR}`, display: 'inline-block' }} />
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
          <TableExportButton
            onFetchAll={fetchAllOrders}
            columns={exportColumns}
            options={{
              fileName: `orders-${dayjs().format('YYYY-MM-DD')}`,
              title: `${t('common:appName')} — ${t('orders.title')}`,
              filters: exportFilters,
              sheetName: t('orders.title'),
            }}
          />
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
          )}</>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: filterW(220) }}
        />
        <Select
          placeholder={t('orders.filterByStatus')}
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: filterW(160) }}
          options={Object.values(OrderStatus).map((s) => ({ label: tEnum('OrderStatus', s), value: s }))}
        />
        <Select
          placeholder={t('orders.orderType')}
          allowClear
          value={orderTypeFilter}
          onChange={(v) => setOrderTypeFilter(v)}
          style={{ width: filterW(160) }}
          options={(orderTypes ?? []).map((ot) => ({
            label: ot.name,
            value: ot.code,
          }))}
        />
        <Select
          placeholder={t('orders.invoiced')}
          allowClear
          value={isInvoicedFilter}
          onChange={(v) => setIsInvoicedFilter(v)}
          style={{ width: filterW(140) }}
          options={[
            { label: t('common:actions.yes'), value: true },
            { label: t('common:actions.no'), value: false },
          ]}
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

      {/* Row tints must be OPAQUE — rgba alpha + opacity break antd's
          fixed-column overlay (the scrolled-under cells bleed through
          the fixed Prioritet + Br. narudžbine cells, see Milos
          22.06.2026 screenshot). Theme tokens give us a backdrop that's
          already pre-blended with the surface color. */}
      <style>{`
        .master-table .master-row-completed td,
        .master-table .master-row-completed .ant-table-cell-fix-left,
        .master-table .master-row-completed .ant-table-cell-fix-right {
          background-color: ${token.colorSuccessBg} !important;
        }
        /* Cancelled rows: dim the text only, leave the cell background
           untouched. antd's colorBgContainerDisabled is semi-transparent
           in dark theme (rgba alpha), so painting it on the fixed cell
           lets Tag fills from scrolled-under cells (orderType) bleed
           through. The red "Otkazan" Status tag already signals
           cancellation strongly enough on its own. */
        .master-table .master-row-cancelled td,
        .master-table .master-row-cancelled .ant-table-cell-fix-left,
        .master-table .master-row-cancelled .ant-table-cell-fix-right {
          color: ${token.colorTextDisabled} !important;
        }
        .master-table .master-row-cancelled .ant-tag {
          opacity: 0.7;
        }
        .master-table .master-row-separator td {
          border-bottom: 3px solid ${token.colorWarning} !important;
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
          ) : detailOrder && (detailOrder.status === OrderStatus.Draft || (ATTACHMENT_RECOVERY && detailOrder.status !== OrderStatus.Cancelled)) && user?.role !== UserRole.SalesManager ? (
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
                          await ordersApi.uploadAttachment(detailOrder.id, compressed, targetItem.id);
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
                  markEditClean();
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
                    <Select options={(orderTypes ?? []).map((ot) => ({
                      label: ot.name,
                      value: ot.code,
                    }))} />
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

              {watchedOrderTypeMeta?.allowsManualProcesses && (
                <Card
                  size="small"
                  style={{ marginTop: 8, borderColor: token.colorPrimaryBorder, background: token.colorPrimaryBg }}
                  title={
                    <Space>
                      <Text strong>{t('orders.manualProcessesTitle')}</Text>
                      <Tag color="blue">{watchedOrderTypeMeta.name}</Tag>
                    </Space>
                  }
                >
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    {t('orders.manualProcessesHelp')}
                  </Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginBottom: 8 }}
                    placeholder={t('orders.manualProcessesPick')}
                    value={manualProcessIds}
                    onChange={(vals: string[]) => setManualProcessIds(vals)}
                    options={(processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
                    optionFilterProp="label"
                  />
                  {manualProcessIds.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {manualProcessIds.map((pid, idx) => {
                        const proc = processMap.get(pid);
                        const otherIds = manualProcessIds.filter((id) => id !== pid);
                        // Adding edge pid → cand cycles if cand already reaches pid via
                        // existing manualDeps. BFS forward from cand.
                        const wouldCycle = (cand: string): boolean => {
                          const visited = new Set<string>();
                          const stack: string[] = [cand];
                          while (stack.length) {
                            const cur = stack.pop()!;
                            if (cur === pid) return true;
                            if (visited.has(cur)) continue;
                            visited.add(cur);
                            for (const next of manualDeps[cur] ?? []) stack.push(next);
                          }
                          return false;
                        };
                        return (
                          <Card key={pid} size="small" bodyStyle={{ padding: 8 }}>
                            <Row gutter={8} align="middle">
                              <Col flex="40px"><Tag>{idx + 1}</Tag></Col>
                              <Col flex="auto">
                                <Text strong>{proc ? `${proc.code} — ${proc.name}` : pid.slice(0, 8)}</Text>
                              </Col>
                              <Col flex="120px">
                                <Select
                                  size="small"
                                  allowClear
                                  style={{ width: '100%' }}
                                  placeholder={t('common:labels.complexity')}
                                  value={manualComplexity[pid]}
                                  onChange={(v) => setManualComplexity((prev) => ({ ...prev, [pid]: v }))}
                                  options={Object.values(ComplexityType).map((c) => ({ label: tEnum('ComplexityType', c), value: c }))}
                                />
                              </Col>
                            </Row>
                            {otherIds.length > 0 && (
                              <Row gutter={8} align="middle" style={{ marginTop: 6 }}>
                                <Col flex="80px">
                                  <Text type="secondary" style={{ fontSize: 12 }}>{t('orders.dependsOn')}</Text>
                                </Col>
                                <Col flex="auto">
                                  <Select
                                    mode="multiple"
                                    size="small"
                                    style={{ width: '100%' }}
                                    placeholder={t('orders.dependsOnPlaceholder')}
                                    value={manualDeps[pid] ?? []}
                                    onChange={(vals: string[]) => setManualDeps((prev) => ({ ...prev, [pid]: vals }))}
                                    options={otherIds.map((id) => {
                                      const p = processMap.get(id);
                                      const cycles = wouldCycle(id);
                                      const isCurrent = (manualDeps[pid] ?? []).includes(id);
                                      return {
                                        label: cycles && !isCurrent
                                          ? `${p ? `${p.code} — ${p.name}` : id.slice(0, 8)} (${t('orders.cycleBlocked')})`
                                          : (p ? `${p.code} — ${p.name}` : id.slice(0, 8)),
                                        value: id,
                                        disabled: cycles && !isCurrent,
                                      };
                                    })}
                                    optionFilterProp="label"
                                  />
                                </Col>
                              </Row>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}
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
                                <FilePdfOutlined style={{ fontSize: 24, color: token.colorError }} />
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

            {/* Order-level Attachments section. Hide the leading divider
                when there are no item cards above — otherwise it stacks
                visually with the divider after the add-item form (Milos
                22.06.2026: two separators with nothing between). */}
            {createPendingItems.length > 0 && <Divider style={{ margin: '12px 0' }} />}
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
                      <FilePdfOutlined style={{ fontSize: 24, color: token.colorError }} />
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
                  #{orderTypeByCode.get(String(detailOrder.orderType).toUpperCase())?.name ?? tEnum('OrderType', detailOrder.orderType)}
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
                  <div style={{ color: token.colorTextSecondary, fontSize: 14, marginBottom: 4 }}>{t('common:labels.deliveryDate')}</div>
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
                <ProcessTimeline order={detailOrder} processes={processes} tEnum={tEnum} masterRow={detailMasterRow ?? undefined} />
              </div>
            )}

            {/* Manual processes (read-only summary) — only when this order has them. */}
            {detailOrder.manualProcesses && detailOrder.manualProcesses.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 12, borderColor: token.colorPrimaryBorder, background: token.colorPrimaryBg }}
                title={
                  <Space>
                    <Text strong>{t('orders.manualProcessesTitle')}</Text>
                    <Tag color="blue">
                      {orderTypeByCode.get(String(detailOrder.orderType).toUpperCase())?.name ?? tEnum('OrderType', detailOrder.orderType)}
                    </Tag>
                  </Space>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...detailOrder.manualProcesses]
                    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                    .map((mp) => {
                      const proc = processMap.get(mp.processId);
                      const deps = (detailOrder.manualProcessDependencies ?? []).filter((d) => d.processId === mp.processId);
                      return (
                        <div key={mp.processId} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Tag>{mp.sequenceOrder}</Tag>
                          <Text strong>{proc ? `${proc.code} — ${proc.name}` : mp.processId.slice(0, 8)}</Text>
                          {mp.defaultComplexity && (
                            <Tag color="default">{tEnum('ComplexityType', mp.defaultComplexity)}</Tag>
                          )}
                          {deps.length > 0 && (
                            <>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('orders.dependsOn')}:</Text>
                              {deps.map((d) => {
                                const dp = processMap.get(d.dependsOnProcessId);
                                return <Tag key={d.dependsOnProcessId}>{dp ? `${dp.code} — ${dp.name}` : d.dependsOnProcessId.slice(0, 8)}</Tag>;
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              </Card>
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
                                <FilePdfOutlined style={{ fontSize: 24, color: token.colorError }} />
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
                      itemProcessReady={detailMasterRow?.itemProcessReady?.[item.id]}
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
                                    style={{ width: 100, ...(pendingVal ? { borderColor: token.colorPrimary } : {}) }}
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
                    <OrderAttachments orderId={detailOrder.id} orderItemId={item.id} attachments={item.attachments ?? []} readOnly={!isDraft && !ATTACHMENT_RECOVERY} ref={(handle) => { if (handle) attachmentRefsMap.current.set(item.id, handle); else attachmentRefsMap.current.delete(item.id); }} />
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
                    style={{ borderStyle: 'dashed', borderColor: token.colorPrimary }}
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
                        <div key={br.id} style={{ padding: 8, background: token.colorErrorBg, border: `1px solid ${token.colorErrorBorder}`, borderRadius: token.borderRadius, fontSize: 12 }}>
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
                        <div key={cr.id} style={{ padding: 8, background: token.colorWarningBg, border: `1px solid ${token.colorWarningBorder}`, borderRadius: token.borderRadius, fontSize: 12 }}>
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
            <OrderAttachments orderId={detailOrder.id} attachments={detailOrder.attachments ?? []} readOnly={detailOrder.status !== OrderStatus.Draft && !ATTACHMENT_RECOVERY} ref={(handle) => { if (handle) attachmentRefsMap.current.set('order', handle); else attachmentRefsMap.current.delete('order'); }} />
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
