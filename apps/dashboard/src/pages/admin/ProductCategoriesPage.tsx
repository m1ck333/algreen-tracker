import { useState } from 'react';
import {
  Typography, Table, Button, Drawer, Form, Input, Tag, Space, App,
  Select, InputNumber, Divider, Popconfirm, Descriptions,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productCategoriesApi, processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type {
  ProductCategoryDto,
  ProductCategoryProcessDto,
  ProductCategoryDependencyDto,
} from '@algreen/shared-types';
import { ComplexityType } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function ProductCategoriesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [addProcessForm] = Form.useForm();
  const [addDepForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  // ─── Queries ──────────────────────────────────────────

  const { data: categories, isLoading } = useQuery({
    queryKey: ['product-categories', tenantId],
    queryFn: () => productCategoriesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['product-categories', detailId],
    queryFn: () => productCategoriesApi.getById(detailId!).then((r) => r.data),
    enabled: !!detailId,
  });

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // ─── Mutations ────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['product-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      productCategoriesApi.create({ tenantId: tenantId!, ...values }),
    onSuccess: (resp) => {
      invalidate();
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.productCategories.created'));
      setDetailId(resp.data.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      productCategoriesApi.update(detailId!, values),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      message.success(t('admin.productCategories.updated'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => productCategoriesApi.deactivate(detailId!),
    onSuccess: () => {
      invalidate();
      setDetailId(null);
      message.success(t('admin.productCategories.deactivated'));
    },
  });

  const addProcessMutation = useMutation({
    mutationFn: (values: { processId: string; sequenceOrder: number; defaultComplexity?: ComplexityType }) =>
      productCategoriesApi.addProcess(detailId!, values),
    onSuccess: () => {
      invalidate();
      addProcessForm.resetFields();
      message.success(t('admin.productCategories.processAdded'));
    },
  });

  const removeProcessMutation = useMutation({
    mutationFn: (processId: string) =>
      productCategoriesApi.removeProcess(detailId!, processId),
    onSuccess: () => {
      invalidate();
      message.success(t('admin.productCategories.processRemoved'));
    },
  });

  const addDepMutation = useMutation({
    mutationFn: (values: { processId: string; dependsOnProcessId: string }) =>
      productCategoriesApi.addDependency(detailId!, values),
    onSuccess: () => {
      invalidate();
      addDepForm.resetFields();
      message.success(t('admin.productCategories.dependencyAdded'));
    },
  });

  const removeDepMutation = useMutation({
    mutationFn: (dependencyId: string) =>
      productCategoriesApi.removeDependency(detailId!, dependencyId),
    onSuccess: () => {
      invalidate();
      message.success(t('admin.productCategories.dependencyRemoved'));
    },
  });

  // ─── Helpers ──────────────────────────────────────────

  const openDetail = (id: string) => {
    setDetailId(id);
    setEditing(false);
  };

  const closeDetail = () => {
    setDetailId(null);
    setEditing(false);
    editForm.resetFields();
    addProcessForm.resetFields();
    addDepForm.resetFields();
  };

  const startEditing = () => {
    if (detail) {
      editForm.setFieldsValue({ name: detail.name, description: detail.description });
    }
    setEditing(true);
  };

  // Processes already assigned to this category
  const assignedProcessIds = new Set(detail?.processes.map((p) => p.processId) ?? []);
  // Available processes not yet assigned
  const availableProcesses = (processes ?? []).filter((p) => !assignedProcessIds.has(p.id) && p.isActive);
  // For dependencies: only processes already in the category
  const categoryProcessOptions = (detail?.processes ?? []).map((p) => ({
    value: p.processId,
    label: `${p.processCode} — ${p.processName}`,
  }));

  // ─── List columns ─────────────────────────────────────

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: (a: ProductCategoryDto, b: ProductCategoryDto) => a.name.localeCompare(b.name),
    },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 100,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: boolean | React.Key, record: ProductCategoryDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? t('common:status.active') : t('common:status.inactive')}
        </Tag>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.productCategories.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.productCategories.addCategory')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({ onClick: () => openDetail(record.id), style: { cursor: 'pointer' } })}
      />

      {/* Create drawer */}
      <Drawer
        title={t('admin.productCategories.createCategory')}
        open={createOpen}
        onClose={() => { createForm.resetFields(); setCreateOpen(false); }}
        width={400}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common:labels.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail / Configure drawer */}
      <Drawer
        title={detail?.name ?? ''}
        open={!!detailId}
        onClose={closeDetail}
        width={640}
        loading={detailLoading}
        extra={
          detail && (
            <Space>
              {editing ? (
                <>
                  <Button onClick={() => setEditing(false)}>{t('common:actions.cancel')}</Button>
                  <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>
                    {t('common:actions.save')}
                  </Button>
                </>
              ) : (
                <>
                  <Button icon={<EditOutlined />} onClick={startEditing}>
                    {t('common:actions.edit')}
                  </Button>
                  <Popconfirm
                    title={t('admin.productCategories.deactivateConfirm')}
                    onConfirm={() => deactivateMutation.mutate()}
                    okText={t('common:actions.confirm')}
                    cancelText={t('common:actions.no')}
                  >
                    <Button danger icon={<DeleteOutlined />} loading={deactivateMutation.isPending}>
                      {t('admin.productCategories.deactivate')}
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          )
        }
      >
        {detail && (
          <>
            {/* Info section */}
            {editing ? (
              <Form
                form={editForm}
                layout="vertical"
                onFinish={(v) => updateMutation.mutate(v)}
              >
                <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="description" label={t('common:labels.description')}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Form>
            ) : (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('common:labels.description')}>
                  {detail.description || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('common:labels.status')}>
                  <Tag color={detail.isActive ? 'green' : 'default'}>
                    {detail.isActive ? t('common:status.active') : t('common:status.inactive')}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* Processes section */}
            <Divider />
            <Title level={5} style={{ marginBottom: 12 }}>
              {t('admin.productCategories.processes', { count: detail.processes.length })}
            </Title>
            <Table<ProductCategoryProcessDto>
              dataSource={detail.processes}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: t('common:labels.process'),
                  render: (_, r) => `${r.processCode} — ${r.processName}`,
                },
                { title: t('common:labels.order'), dataIndex: 'sequenceOrder', width: 80, align: 'center' },
                {
                  title: t('admin.productCategories.defaultComplexity'),
                  dataIndex: 'defaultComplexity',
                  width: 120,
                  render: (v: ComplexityType | null) =>
                    v ? <Tag>{t(`common:enums.ComplexityType.${v}`)}</Tag> : '—',
                },
                {
                  title: '',
                  width: 50,
                  render: (_, r) => (
                    <Popconfirm
                      title={t('admin.productCategories.removeProcessConfirm')}
                      onConfirm={() => removeProcessMutation.mutate(r.processId)}
                      okText={t('common:actions.confirm')}
                      cancelText={t('common:actions.no')}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  ),
                },
              ]}
            />

            {availableProcesses.length > 0 && (
              <Form
                form={addProcessForm}
                layout="inline"
                style={{ marginTop: 12 }}
                onFinish={(v) => addProcessMutation.mutate(v)}
              >
                <Form.Item name="processId" rules={[{ required: true }]} style={{ minWidth: 200 }}>
                  <Select
                    placeholder={t('admin.productCategories.selectProcess')}
                    options={availableProcesses.map((p) => ({
                      value: p.id,
                      label: `${p.code} — ${p.name}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="sequenceOrder" rules={[{ required: true }]} initialValue={detail.processes.length + 1}>
                  <InputNumber min={1} placeholder={t('common:labels.order')} style={{ width: 80 }} />
                </Form.Item>
                <Form.Item name="defaultComplexity">
                  <Select
                    placeholder={t('common:labels.complexity')}
                    allowClear
                    style={{ width: 110 }}
                    options={Object.values(ComplexityType).map((c) => ({
                      value: c,
                      label: t(`common:enums.ComplexityType.${c}`),
                    }))}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    htmlType="submit"
                    loading={addProcessMutation.isPending}
                  >
                    {t('common:actions.add')}
                  </Button>
                </Form.Item>
              </Form>
            )}

            {/* Dependencies section */}
            <Divider />
            <Title level={5} style={{ marginBottom: 12 }}>
              {t('admin.productCategories.dependencies', { count: detail.dependencies.length })}
            </Title>
            <Table<ProductCategoryDependencyDto>
              dataSource={detail.dependencies}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t('common:labels.process'), dataIndex: 'processCode', width: 120 },
                { title: t('admin.productCategories.dependsOn'), dataIndex: 'dependsOnProcessCode' },
                {
                  title: '',
                  width: 50,
                  render: (_, r) => (
                    <Popconfirm
                      title={t('admin.productCategories.removeDependencyConfirm')}
                      onConfirm={() => removeDepMutation.mutate(r.id)}
                      okText={t('common:actions.confirm')}
                      cancelText={t('common:actions.no')}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  ),
                },
              ]}
            />

            {categoryProcessOptions.length >= 2 && (
              <Form
                form={addDepForm}
                layout="inline"
                style={{ marginTop: 12 }}
                onFinish={(v) => addDepMutation.mutate(v)}
              >
                <Form.Item
                  name="processId"
                  rules={[{ required: true }]}
                  style={{ minWidth: 180 }}
                >
                  <Select
                    placeholder={t('common:labels.process')}
                    options={categoryProcessOptions}
                    onChange={() => addDepForm.validateFields(['dependsOnProcessId']).catch(() => {})}
                  />
                </Form.Item>
                <Form.Item
                  name="dependsOnProcessId"
                  rules={[
                    { required: true },
                    {
                      validator: (_, value) => {
                        if (value && value === addDepForm.getFieldValue('processId')) {
                          return Promise.reject(t('admin.productCategories.sameProcessError'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                  style={{ minWidth: 180 }}
                >
                  <Select
                    placeholder={t('admin.productCategories.dependsOn')}
                    options={categoryProcessOptions}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    htmlType="submit"
                    loading={addDepMutation.isPending}
                  >
                    {t('common:actions.add')}
                  </Button>
                </Form.Item>
              </Form>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
