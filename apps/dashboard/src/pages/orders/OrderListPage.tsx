import { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Space, Select, Tag, Drawer, Form, Input,
  InputNumber, DatePicker, App, Row, Col, Descriptions, Collapse, Spin, Popconfirm, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@algreen/auth';
import { OrderStatus, OrderType, UserRole } from '@algreen/shared-types';
import type { OrderDto, OrderItemDto, OrderItemProcessDto, ProductCategoryDto } from '@algreen/shared-types';
import {
  useOrders, useCreateOrder, useOrder, useActivateOrder,
  useUpdateOrder, useCancelOrder, usePauseOrder, useResumeOrder,
  useAddOrderItem, useRemoveOrderItem,
} from '../../hooks/useOrders';
import { productCategoriesApi } from '@algreen/api-client';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

export function OrderListPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.tenantId);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);
  const { data: ordersResult, isLoading } = useOrders({ status: statusFilter });
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
    queryFn: () => productCategoriesApi.getAll(tenantId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId && addingItem,
  });
  const { message, modal } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  useEffect(() => {
    if (editing && detailOrder) {
      editForm.setFieldsValue({
        notes: detailOrder.notes,
        customWarningDays: detailOrder.customWarningDays,
        customCriticalDays: detailOrder.customCriticalDays,
      });
    }
  }, [editing, detailOrder, editForm]);

  const canCreate =
    user?.role === UserRole.SalesManager ||
    user?.role === UserRole.Manager ||
    user?.role === UserRole.Admin;

  const onCreateFinish = async (values: Record<string, unknown>) => {
    try {
      await createOrder.mutateAsync({
        tenantId: tenantId!,
        orderNumber: values.orderNumber as string,
        deliveryDate: (values.deliveryDate as { toISOString: () => string }).toISOString(),
        priority: values.priority as number,
        orderType: values.orderType as OrderType,
        notes: values.notes as string | undefined,
      });
      message.success(t('orders.createdSuccess'));
      form.resetFields();
      setCreateDrawerOpen(false);
    } catch {
      message.error(t('orders.createFailed'));
    }
  };

  const processColumns = [
    { title: t('common:labels.process'), dataIndex: 'processId', key: 'processId', ellipsis: true },
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderItemProcessDto['status']) => <StatusBadge status={status} />,
    },
    { title: t('common:labels.complexity'), dataIndex: 'complexity', key: 'complexity' },
    { title: t('orders.durationMin'), dataIndex: 'totalDurationMinutes', key: 'duration' },
  ];

  const columns: ColumnsType<OrderDto> = [
    {
      title: t('orders.orderNumber'),
      dataIndex: 'orderNumber',
      sorter: (a, b) => a.orderNumber.localeCompare(b.orderNumber),
    },
    {
      title: t('common:labels.type'),
      dataIndex: 'orderType',
      render: (type) => <Tag>{tEnum('OrderType', type)}</Tag>,
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      title: t('common:labels.priority'),
      dataIndex: 'priority',
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: t('common:labels.deliveryDate'),
      dataIndex: 'deliveryDate',
      render: (date) => dayjs(date).format('DD.MM.YYYY'),
      sorter: (a, b) => dayjs(a.deliveryDate).unix() - dayjs(b.deliveryDate).unix(),
    },
    {
      title: t('common:labels.items'),
      dataIndex: 'itemCount',
    },
    {
      title: t('common:labels.actions'),
      render: (_, record) => record.status === OrderStatus.Draft ? (
        <Button type="link" onClick={() => {
          setDetailOrderId(record.id);
          setEditing(true);
        }}>
          {t('orders.editOrder')}
        </Button>
      ) : (
        <Button type="link" onClick={() => setDetailOrderId(record.id)}>
          {t('common:actions.view')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('orders.title')}
        </Title>
        <Space>
          <Select
            placeholder={t('orders.filterByStatus')}
            allowClear
            style={{ width: 160 }}
            onChange={setStatusFilter}
            options={Object.values(OrderStatus).map((s) => ({ label: tEnum('OrderStatus', s), value: s }))}
          />
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateDrawerOpen(true)}
            >
              {t('orders.createOrder')}
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={ordersResult?.items}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      {/* Create Order Drawer */}
      <Drawer
        title={t('orders.createOrder')}
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        width={Math.min(480, window.innerWidth)}
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
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
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

            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" loading={createOrder.isPending}>
                  {t('orders.createOrder')}
                </Button>
                <Button onClick={() => setCreateDrawerOpen(false)}>
                  {t('common:actions.cancel')}
                </Button>
              </Space>
            </Form.Item>
          </div>
        </Form>
      </Drawer>

      {/* Order Detail Drawer */}
      <Drawer
        title={detailOrder ? t('orders.order', { number: detailOrder.orderNumber }) : ''}
        open={!!detailOrderId}
        onClose={() => { setDetailOrderId(null); setEditing(false); setAddingItem(false); }}
        width={Math.min(640, window.innerWidth)}
        extra={detailOrder && (
          <Space size="small">
            {detailOrder.status === OrderStatus.Draft && (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>{t('orders.editOrder')}</Button>
                <Button type="primary" size="small" loading={activateMutation.isPending}
                  onClick={() => {
                    activateMutation.mutate(detailOrder.id, { onSuccess: () => message.success(t('orders.activatedSuccess')) });
                  }}
                >{t('orders.activateOrder')}</Button>
              </>
            )}
            {detailOrder.status === OrderStatus.Active && (
              <Button size="small" onClick={() => {
                pauseOrder.mutate(detailOrder.id, { onSuccess: () => message.success(t('orders.pausedSuccess')) });
              }} loading={pauseOrder.isPending}>{t('orders.pauseOrder')}</Button>
            )}
            {detailOrder.status === OrderStatus.Paused && (
              <Button size="small" onClick={() => {
                resumeOrder.mutate(detailOrder.id, { onSuccess: () => message.success(t('orders.resumedSuccess')) });
              }} loading={resumeOrder.isPending}>{t('orders.resumeOrder')}</Button>
            )}
            {detailOrder.status !== OrderStatus.Cancelled && detailOrder.status !== OrderStatus.Completed && (
              <Popconfirm
                title={t('orders.cancelConfirm')}
                onConfirm={() => {
                  cancelOrder.mutate(detailOrder.id, {
                    onSuccess: () => message.success(t('orders.cancelledSuccess')),
                    onError: () => message.error(t('orders.cancelFailed')),
                  });
                }}
              >
                <Button size="small" danger loading={cancelOrder.isPending}>{t('orders.cancelOrder')}</Button>
              </Popconfirm>
            )}
          </Space>
        )}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : detailOrder ? (
          <>
            {/* Edit form */}
            {editing ? (
              <>
                <Form form={editForm} layout="vertical" size="small" onFinish={async (values) => {
                  try {
                    await updateOrder.mutateAsync({ id: detailOrder.id, data: values });
                    message.success(t('orders.updatedSuccess'));
                    setEditing(false);
                  } catch { message.error(t('orders.updateFailed')); }
                }}>
                  <Form.Item name="notes" label={t('common:labels.notes')}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
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
                  <Space>
                    <Button type="primary" htmlType="submit" loading={updateOrder.isPending}>{t('common:actions.save')}</Button>
                    <Button onClick={() => setEditing(false)}>{t('common:actions.cancel')}</Button>
                  </Space>
                </Form>
                <Divider />
              </>
            ) : (
              <Descriptions size="small" bordered column={2}>
                <Descriptions.Item label={t('common:labels.status')}>
                  <StatusBadge status={detailOrder.status} />
                </Descriptions.Item>
                <Descriptions.Item label={t('common:labels.type')}>
                  <Tag>{tEnum('OrderType', detailOrder.orderType)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('common:labels.priority')}>
                  {detailOrder.priority}
                </Descriptions.Item>
                <Descriptions.Item label={t('common:labels.deliveryDate')}>
                  {dayjs(detailOrder.deliveryDate).format('DD.MM.YYYY')}
                </Descriptions.Item>
                {detailOrder.notes && (
                  <Descriptions.Item label={t('common:labels.notes')} span={2}>
                    {detailOrder.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {/* Items */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('orders.items', { count: detailOrder.items.length })}
              </Title>
              {detailOrder.status === OrderStatus.Draft && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingItem(true)}>
                  {t('orders.addItem')}
                </Button>
              )}
            </div>

            {/* Add Item form */}
            {addingItem && (
              <>
                <Form form={itemForm} layout="vertical" size="small" onFinish={async (values) => {
                  try {
                    await addItemMutation.mutateAsync(values);
                    message.success(t('orders.addItemSuccess'));
                    itemForm.resetFields();
                    setAddingItem(false);
                  } catch { message.error(t('orders.createFailed')); }
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
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" htmlType="submit" loading={addItemMutation.isPending}>{t('orders.addItem')}</Button>
                    <Button onClick={() => setAddingItem(false)}>{t('common:actions.cancel')}</Button>
                  </Space>
                </Form>
                <Divider style={{ margin: '8px 0' }} />
              </>
            )}

            <Collapse
              size="small"
              items={detailOrder.items.map((item: OrderItemDto) => ({
                key: item.id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{item.productName} ({t('orders.qty', { count: item.quantity })})</span>
                    {detailOrder.status === OrderStatus.Draft && (
                      <Popconfirm
                        title={t('orders.cancelConfirm')}
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          removeItemMutation.mutate(item.id, { onSuccess: () => message.success(t('orders.removeItemSuccess')) });
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>
                    )}
                  </div>
                ),
                children: (
                  <Table
                    columns={processColumns}
                    dataSource={item.processes}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                ),
              }))}
            />
          </>
        ) : (
          <Typography.Text>{t('orders.orderNotFound')}</Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
