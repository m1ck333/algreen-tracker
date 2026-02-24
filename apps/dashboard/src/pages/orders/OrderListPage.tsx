import { useState, useEffect, useMemo } from 'react';
import {
  Typography, Table, Button, Space, Select, Tag, Drawer, Form, Input,
  InputNumber, DatePicker, App, Row, Col, Spin, Popconfirm, Divider,
  Tooltip, Progress, Card, Statistic,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@algreen/auth';
import { OrderStatus, OrderType, ProcessStatus, ComplexityType, UserRole } from '@algreen/shared-types';
import type { OrderMasterViewDto, OrderDetailDto, OrderItemDto, ProcessDto, ProductCategoryDto, SpecialRequestTypeDto } from '@algreen/shared-types';
import {
  useCreateOrder, useOrder, useActivateOrder,
  useUpdateOrder, useCancelOrder, usePauseOrder, useResumeOrder,
  useAddOrderItem, useRemoveOrderItem,
} from '../../hooks/useOrders';
import { productCategoriesApi, processesApi, ordersApi, specialRequestTypesApi } from '@algreen/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
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
  const code = getApiErrorCode(error);
  if (code) {
    const translated = t(`common:errors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return fallback;
}

/** Aggregate process status across all items in an order for a given processId (used in detail drawer) */
function getAggregateProcessStatus(
  order: OrderDetailDto,
  processId: string,
): ProcessStatus | null {
  const statuses: ProcessStatus[] = [];
  for (const item of order.items) {
    const proc = item.processes.find((p) => p.processId === processId);
    if (proc) statuses.push(proc.status);
  }
  if (statuses.length === 0) return null;
  if (statuses.includes(ProcessStatus.Blocked)) return ProcessStatus.Blocked;
  if (statuses.includes(ProcessStatus.Stopped)) return ProcessStatus.Stopped;
  if (statuses.includes(ProcessStatus.InProgress)) return ProcessStatus.InProgress;
  if (statuses.includes(ProcessStatus.Pending)) return ProcessStatus.Pending;
  if (statuses.every((s) => s === ProcessStatus.Completed)) return ProcessStatus.Completed;
  if (statuses.every((s) => s === ProcessStatus.Withdrawn)) return ProcessStatus.Withdrawn;
  return ProcessStatus.Completed;
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

function ProcessCell({
  status,
  processName,
  tEnum,
}: {
  status: ProcessStatus | null;
  processName: string;
  tEnum: (enumName: string, value: string) => string;
}) {
  if (status === null) {
    return (
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: '1px dashed #E0E0E0',
      }} />
    );
  }

  const color = processStatusColors[status];
  const label = tEnum('ProcessStatus', status);

  return (
    <Tooltip title={`${processName}: ${label}`}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          backgroundColor: color,
          border: '1px solid rgba(0,0,0,0.1)',
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
}: {
  order: OrderDetailDto;
  processes: ProcessDto[];
  tEnum: (enumName: string, value: string) => string;
}) {
  const { t } = useTranslation('dashboard');
  const STEP = 48; // px per process step
  const CIRCLE = 24;
  const totalWidth = processes.length * STEP;

  // Pre-compute statuses
  const statuses = processes.map((proc) => getAggregateProcessStatus(order, proc.id));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ position: 'relative', width: totalWidth, height: 44, marginLeft: 4, marginRight: 4 }}>
        {/* Connector lines layer */}
        {processes.map((proc, i) => {
          if (i === 0) return null;
          const prevCompleted = statuses[i - 1] === ProcessStatus.Completed;
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
          const status = statuses[i];
          const color = status ? processStatusColors[status] : '#F0F0F0';
          const isCompleted = status === ProcessStatus.Completed;
          const x = i * STEP;

          return (
            <Tooltip key={proc.id} title={`${proc.name}: ${status ? tEnum('ProcessStatus', status) : t('orders.processNotApplicable')}`}>
              <div style={{ position: 'absolute', left: x, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: STEP }}>
                <div style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '2px solid ' + (status ? color : '#D9D9D9'),
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
}: {
  item: OrderItemDto;
  processMap: Map<string, ProcessDto>;
  tEnum: (enumName: string, value: string) => string;
}) {
  const sorted = [...item.processes]
    .filter((p) => p.status !== ProcessStatus.Withdrawn)
    .sort((a, b) => {
      const pa = processMap.get(a.processId);
      const pb = processMap.get(b.processId);
      return (pa?.sequenceOrder ?? 0) - (pb?.sequenceOrder ?? 0);
    });

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {sorted.map((proc) => {
        const process = processMap.get(proc.processId);
        const color = processStatusColors[proc.status];
        const statusLabel = tEnum('ProcessStatus', proc.status);
        return (
          <Tooltip
            key={proc.id}
            title={
              <div>
                <div><b>{process?.name ?? proc.processId}</b></div>
                <div>{statusLabel}</div>
                {(proc.complexity || proc.totalDurationMinutes > 0) && (
                  <div>{proc.complexity ?? ''}{proc.totalDurationMinutes > 0 ? `${proc.complexity ? ' · ' : ''}${proc.totalDurationMinutes} min` : ''}</div>
                )}
              </div>
            }
          >
            <div style={{
              padding: '2px 6px',
              borderRadius: 4,
              backgroundColor: color,
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: 11,
              fontWeight: 500,
              color: proc.status === ProcessStatus.Pending || proc.status === ProcessStatus.Withdrawn ? '#666' : '#fff',
              cursor: 'default',
              lineHeight: '16px',
            }}>
              {process?.code ?? '?'}{proc.complexity ? <span style={{ opacity: 0.85 }}> {proc.complexity}</span> : null}
            </div>
          </Tooltip>
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
  const { data: masterData, isLoading } = useQuery({
    queryKey: ['orders-master-view', tenantId, statusFilter],
    queryFn: () => ordersApi.getMasterView({ tenantId: tenantId!, status: statusFilter }).then((r) => r.data.items),
    enabled: !!tenantId,
  });
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const cancelOrder = useCancelOrder();
  const pauseOrder = usePauseOrder();
  const resumeOrder = useResumeOrder();
  const { data: detailOrder, isLoading: detailLoading } = useOrder(detailOrderId ?? undefined);
  const activateMutation = useActivateOrder();
  const addItemMutation = useAddOrderItem(detailOrderId ?? '');
  const removeItemMutation = useRemoveOrderItem(detailOrderId ?? '');
  const { data: categories } = useQuery({
    queryKey: ['product-categories', tenantId],
    queryFn: () => productCategoriesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId && addingItem,
  });
  const { data: specialRequestTypes } = useQuery({
    queryKey: ['special-request-types', tenantId],
    queryFn: () => specialRequestTypesApi.getAll(tenantId!).then((r) => r.data.items),
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
    queryFn: () => processesApi.getAll(tenantId!).then((r) =>
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

  const changePriorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) => ordersApi.changePriority(id, priority),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders-master-view'] }); },
  });

  const addSpecialRequestMutation = useMutation({
    mutationFn: ({ orderId, itemId, specialRequestTypeId }: { orderId: string; itemId: string; specialRequestTypeId: string }) =>
      ordersApi.addSpecialRequest(orderId, itemId, { specialRequestTypeId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders', detailOrderId] }); },
  });

  const removeSpecialRequestMutation = useMutation({
    mutationFn: ({ orderId, itemId, specialRequestId }: { orderId: string; itemId: string; specialRequestId: string }) =>
      ordersApi.removeSpecialRequest(orderId, itemId, specialRequestId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders', detailOrderId] }); },
  });

  const overrideComplexityMutation = useMutation({
    mutationFn: ({ orderId, itemId, processId, complexity }: { orderId: string; itemId: string; processId: string; complexity: ComplexityType }) =>
      ordersApi.overrideComplexity(orderId, itemId, processId, { complexity }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders', detailOrderId] }); },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { targetProcessId: string; reason: string; userId: string } }) =>
      ordersApi.withdraw(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      queryClient.invalidateQueries({ queryKey: ['orders', detailOrderId] });
    },
  });

  useEffect(() => {
    if (detailOrder) {
      editForm.setFieldsValue({
        notes: detailOrder.notes,
        customWarningDays: detailOrder.customWarningDays,
        customCriticalDays: detailOrder.customCriticalDays,
      });
    }
  }, [detailOrder, editForm]);

  const canCreate =
    user?.role === UserRole.SalesManager ||
    user?.role === UserRole.Manager ||
    user?.role === UserRole.Admin;

  const onCreateFinish = async (values: Record<string, unknown>) => {
    try {
      await createOrder.mutateAsync({
        tenantId: tenantId!,
        orderNumber: values.orderNumber as string,
        deliveryDate: dayjs(values.deliveryDate as string).format('YYYY-MM-DD') + 'T12:00:00Z',
        priority: values.priority as number,
        orderType: values.orderType as OrderType,
        notes: values.notes as string | undefined,
      });
      message.success(t('orders.createdSuccess'));
      form.resetFields();
      setCreateDrawerOpen(false);
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
        sorter: (a, b) => a.priority - b.priority,
        defaultSortOrder: 'ascend',
      },
      {
        title: t('orders.orderNumber'),
        dataIndex: 'orderNumber',
        width: 160,
        render: (text: string, record: OrderMasterViewDto) => (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailOrderId(record.id)}>
            {text}
          </Button>
        ),
      },
      {
        title: t('orders.orderType'),
        dataIndex: 'orderType',
        width: 90,
        render: (type: OrderType) => (
          <Tag color={orderTypeColors[type]}>{tEnum('OrderType', type)}</Tag>
        ),
      },
      {
        title: t('common:labels.status'),
        dataIndex: 'status',
        width: 110,
        filters: Object.values(OrderStatus).map((s) => ({ text: tEnum('OrderStatus', s), value: s })),
        filteredValue: statusFilter ? [statusFilter] : null,
        filterMultiple: false,
        render: (status) => <StatusBadge status={status} />,
      },
      {
        title: t('common:labels.deliveryDate'),
        dataIndex: 'deliveryDate',
        width: 110,
        sorter: (a, b) => dayjs(a.deliveryDate).unix() - dayjs(b.deliveryDate).unix(),
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
    const processColDefs: ColumnsType<OrderMasterViewDto> = (processes ?? []).map((proc) => ({
      title: (
        <Tooltip title={proc.name}>
          <span style={{ fontSize: 11, cursor: 'default' }}>{proc.code}</span>
        </Tooltip>
      ),
      key: proc.id,
      width: 44,
      align: 'center' as const,
      render: (_: unknown, record: OrderMasterViewDto) => {
        const statusStr = record.processStatuses[proc.id];
        const status = statusStr ? (statusStr as ProcessStatus) : null;
        return <ProcessCell status={status} processName={proc.name} tEnum={tEnum} />;
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
  }, [processes, statusFilter, t, tEnum]);

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('orders.title')}
        </Title>
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateDrawerOpen(true)}
          >
            {t('orders.createOrder')}
          </Button>
        )}
      </div>

      <Table<OrderMasterViewDto>
        className="master-table"
        columns={masterColumns}
        dataSource={masterData}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        size="small"
        bordered
        onChange={(_pagination, filters) => {
          const val = filters.status?.[0] as OrderStatus | undefined;
          setStatusFilter(val);
        }}
        rowClassName={(record) => {
          if (record.status === OrderStatus.Completed) return 'master-row-completed';
          if (record.status === OrderStatus.Cancelled) return 'master-row-cancelled';
          return '';
        }}
      />

      <style>{`
        .master-table .master-row-completed td {
          background-color: rgba(146, 208, 80, 0.1) !important;
        }
        .master-table .master-row-cancelled td {
          opacity: 0.5;
        }
      `}</style>

      {/* Create Order Drawer */}
      <Drawer
        title={t('orders.createOrder')}
        open={createDrawerOpen}
        onClose={() => { setCreateDrawerOpen(false); form.resetFields(); }}
        width={Math.min(480, window.innerWidth)}
        extra={
          <Button type="primary" onClick={() => form.submit()} loading={createOrder.isPending}>
            {t('common:actions.save')}
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={onCreateFinish} size="middle">
          <style>{`.create-order-drawer .ant-form-item-explain { font-size: 12px; }`}</style>
          <div className="create-order-drawer">
            <Row gutter={12}>
              <Col span={14}>
                <Form.Item
                  name="orderNumber"
                  label={t('orders.orderNumberLabel')}
                  rules={[{ required: true }]}
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
                  <Select
                    options={Object.values(OrderType).map((ot) => ({ label: tEnum('OrderType', ot), value: ot }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={14}>
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
                        if (selected < tomorrow) {
                          return Promise.reject(t('common:errors.INVALID_DATE'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.format('YYYY-MM-DD') <= dayjs().format('YYYY-MM-DD')} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  name="priority"
                  label={t('common:labels.priority')}
                  rules={[{ required: true }]}
                  initialValue={1}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="notes" label={t('common:labels.notes')}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Drawer>

      {/* Order Detail Drawer */}
      <Drawer
        title={detailOrder ? t('orders.order', { number: detailOrder.orderNumber }) : ''}
        open={!!detailOrderId}
        onClose={() => { setDetailOrderId(null); setAddingItem(false); editForm.resetFields(); itemForm.resetFields(); }}
        width={Math.min(640, window.innerWidth)}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : detailOrder ? (
          <>
            {/* Header: tags + action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
              <Space size={4} wrap>
                <Text style={{ color: orderTypeTextColors[detailOrder.orderType], fontWeight: 500 }}>
                  #{tEnum('OrderType', detailOrder.orderType)}
                </Text>
                <StatusText status={detailOrder.status} />
              </Space>
              <Space size="small" wrap style={{ justifyContent: 'flex-end' }}>
                {detailOrder.status === OrderStatus.Draft && (
                  <Button type="primary" size="small" loading={activateMutation.isPending}
                    onClick={() => {
                      activateMutation.mutate(detailOrder.id, {
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
                {detailOrder.status === OrderStatus.Active && (
                  <Button size="small" onClick={() => {
                    const withdrawForm = modal.confirm({
                      title: t('orders.withdrawTitle'),
                      icon: null,
                      content: (
                        <Form
                          id="withdraw-form"
                          layout="vertical"
                          style={{ marginTop: 12 }}
                          onFinish={(vals) => {
                            withdrawMutation.mutate(
                              { id: detailOrder.id, data: { targetProcessId: vals.targetProcessId, reason: vals.reason, userId: user!.id } },
                              {
                                onSuccess: () => { message.success(t('orders.withdrawSuccess')); withdrawForm.destroy(); },
                                onError: (err) => message.error(getTranslatedError(err, t, t('orders.withdrawFailed'))),
                              },
                            );
                          }}
                        >
                          <Form.Item name="targetProcessId" label={t('orders.withdrawToProcess')} rules={[{ required: true }]}>
                            <Select options={(processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))} />
                          </Form.Item>
                          <Form.Item name="reason" label={t('orders.withdrawReason')} rules={[{ required: true }]}>
                            <Input.TextArea rows={2} />
                          </Form.Item>
                        </Form>
                      ),
                      okButtonProps: { htmlType: 'submit', form: 'withdraw-form' },
                      okText: t('common:actions.confirm'),
                      cancelText: t('common:actions.cancel'),
                    });
                  }}>{t('orders.withdraw')}</Button>
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
              </Space>
            </div>

            {/* A) Stats Row */}
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={8}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{t('common:labels.priority')}</Text>
                  <Space size={4}>
                    <InputNumber
                      size="small"
                      min={1}
                      max={100}
                      value={detailOrder.priority}
                      style={{ width: 64 }}
                      disabled={detailOrder.status === OrderStatus.Cancelled || detailOrder.status === OrderStatus.Completed}
                      onChange={(val) => {
                        if (val && val !== detailOrder.priority) {
                          changePriorityMutation.mutate(
                            { id: detailOrder.id, priority: val },
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
                <Statistic
                  title={t('common:labels.deliveryDate')}
                  value={dayjs(detailOrder.deliveryDate).format('DD.MM.YYYY.')}
                  valueStyle={{ color: deliveryDateColor, fontSize: 20 }}
                />
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
            {processes && processes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                  {t('orders.processFlow')}
                </Text>
                <ProcessTimeline order={detailOrder} processes={processes} tEnum={tEnum} />
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

            {/* Add Item form */}
            {addingItem && (
              <>
                <Form form={itemForm} layout="vertical" size="middle" onFinish={async (values) => {
                  try {
                    await addItemMutation.mutateAsync(values);
                    message.success(t('orders.addItemSuccess'));
                    itemForm.resetFields();
                    setAddingItem(false);
                  } catch (err) { message.error(getTranslatedError(err, t, t('orders.addItemFailed'))); }
                }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="productCategoryId" label={t('orders.productCategory')} rules={[{ required: true }]}>
                        <Select
                          options={(categories ?? []).map((c: ProductCategoryDto) => ({ label: c.name, value: c.id }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="productName" label={t('orders.productName')} rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="quantity" label={t('orders.quantity')} rules={[{ required: true }]} initialValue={1}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="notes" label={t('common:labels.notes')}>
                        <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" htmlType="submit" loading={addItemMutation.isPending}>{t('common:actions.save')}</Button>
                    <Button onClick={() => setAddingItem(false)}>{t('common:actions.cancel')}</Button>
                  </Space>
                </Form>
                <Divider style={{ margin: '8px 0' }} />
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detailOrder.items.map((item: OrderItemDto) => (
                <Card
                  key={item.id}
                  size="small"
                  title={
                    <Space>
                      <span>{item.productName}</span>
                      <Tag>{t('orders.qty', { count: item.quantity })}</Tag>
                    </Space>
                  }
                  extra={detailOrder.status === OrderStatus.Draft && (
                    <Popconfirm
                      title={t('orders.cancelConfirm')}
                      onConfirm={() => {
                        removeItemMutation.mutate(item.id, {
                          onSuccess: () => message.success(t('orders.removeItemSuccess')),
                          onError: (err) => message.error(getTranslatedError(err, t, t('orders.removeItemFailed'))),
                        });
                      }}
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                >
                  <ItemProcessBar item={item} processMap={processMap} tEnum={tEnum} />

                  {/* Special Requests */}
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{t('orders.specialRequests')}: </Text>
                    {item.specialRequests.length > 0 ? (
                      item.specialRequests.map((sr) => {
                        const srt = srtMap.get(sr.specialRequestTypeId);
                        return (
                          <Tag
                            key={sr.id}
                            color="purple"
                            closable={detailOrder.status === OrderStatus.Draft}
                            onClose={(e) => {
                              e.preventDefault();
                              removeSpecialRequestMutation.mutate(
                                { orderId: detailOrder.id, itemId: item.id, specialRequestId: sr.id },
                                { onSuccess: () => message.success(t('orders.specialRequestRemoved')) },
                              );
                            }}
                            style={{ marginBottom: 2 }}
                          >
                            {srt ? srt.name : sr.specialRequestTypeId.slice(0, 8)}
                          </Tag>
                        );
                      })
                    ) : (
                      <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                    )}
                    {detailOrder.status === OrderStatus.Draft && (
                      <Select
                        size="small"
                        placeholder={`+ ${t('common:actions.add')}`}
                        style={{ width: 140, marginLeft: 4 }}
                        value={undefined}
                        options={(specialRequestTypes ?? [])
                          .filter((srt) => srt.isActive && !item.specialRequests.some((sr) => sr.specialRequestTypeId === srt.id))
                          .map((srt) => ({ label: srt.name, value: srt.id }))}
                        onChange={(val) => {
                          if (val) {
                            addSpecialRequestMutation.mutate(
                              { orderId: detailOrder.id, itemId: item.id, specialRequestTypeId: val },
                              { onSuccess: () => message.success(t('orders.specialRequestAdded')) },
                            );
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Complexity overrides */}
                  {detailOrder.status !== OrderStatus.Cancelled && item.processes.filter((p) => p.status !== ProcessStatus.Withdrawn).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>{t('orders.complexityOverrides')}:</Text>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[...item.processes]
                          .filter((p) => p.status !== ProcessStatus.Withdrawn)
                          .sort((a, b) => {
                            const pa = processMap.get(a.processId);
                            const pb = processMap.get(b.processId);
                            return (pa?.sequenceOrder ?? 0) - (pb?.sequenceOrder ?? 0);
                          })
                          .map((proc) => {
                            const process = processMap.get(proc.processId);
                            return (
                              <Tooltip key={proc.id} title={process?.name ?? proc.processId}>
                                <Select
                                  size="small"
                                  value={proc.complexity}
                                  placeholder={process?.code ?? '?'}
                                  allowClear
                                  style={{ width: 72 }}
                                  options={Object.values(ComplexityType).map((c) => ({
                                    label: `${process?.code ?? '?'} ${tEnum('ComplexityType', c)}`,
                                    value: c,
                                  }))}
                                  onChange={(val) => {
                                    if (val) {
                                      overrideComplexityMutation.mutate(
                                        { orderId: detailOrder.id, itemId: item.id, processId: proc.id, complexity: val },
                                        {
                                          onSuccess: () => message.success(t('orders.complexityOverridden')),
                                          onError: (err) => message.error(getTranslatedError(err, t, t('orders.complexityOverrideFailed'))),
                                        },
                                      );
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
                </Card>
              ))}
            </div>

            {/* D) Notes / Draft edit form */}
            {detailOrder.status === OrderStatus.Draft ? (
              <Form form={editForm} layout="vertical" size="middle" style={{ marginTop: 20 }} onFinish={async (values) => {
                try {
                  await updateOrder.mutateAsync({ id: detailOrder.id, data: values });
                  message.success(t('orders.updatedSuccess'));
                } catch (err) { message.error(getTranslatedError(err, t, t('orders.updateFailed'))); }
              }}>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Item name="notes" label={t('common:labels.notes')}>
                      <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="customWarningDays" label={t('orders.warningDays')}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="customCriticalDays" label={t('orders.criticalDays')}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" size="small" loading={updateOrder.isPending}>
                  {t('common:actions.save')}
                </Button>
              </Form>
            ) : detailOrder.notes ? (
              <div style={{ marginTop: 20 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {t('common:labels.notes')}
                </Text>
                <Text>{detailOrder.notes}</Text>
              </div>
            ) : null}
          </>
        ) : (
          <Typography.Text>{t('orders.orderNotFound')}</Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
