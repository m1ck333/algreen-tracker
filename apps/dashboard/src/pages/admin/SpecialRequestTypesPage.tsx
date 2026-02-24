import { useState, useMemo } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, Space, App, Popconfirm, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specialRequestTypesApi, processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { SpecialRequestTypeDto, ProcessDto } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';

const { Title, Text } = Typography;

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

export function SpecialRequestTypesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SpecialRequestTypeDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['special-request-types', tenantId],
    queryFn: () => specialRequestTypesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId && (!!detailItem || createOpen),
  });

  const processMap = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    (processes ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [processes]);

  const processOptions = (processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }));

  // Refresh detail from list data
  const currentDetail = detailItem ? data?.find((item) => item.id === detailItem.id) ?? detailItem : null;

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      specialRequestTypesApi.create({
        tenantId: tenantId!,
        code: values.code as string,
        name: values.name as string,
        description: values.description as string | undefined,
        addsProcesses: values.addsProcesses as string[] | undefined,
        removesProcesses: values.removesProcesses as string[] | undefined,
        onlyProcesses: values.onlyProcesses as string[] | undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.specialRequestTypes.created'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      specialRequestTypesApi.update(id, {
        name: values.name as string,
        description: values.description as string | undefined,
        addsProcesses: values.addsProcesses as string[] | undefined,
        removesProcesses: values.removesProcesses as string[] | undefined,
        onlyProcesses: values.onlyProcesses as string[] | undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setEditing(false);
      message.success(t('admin.specialRequestTypes.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.updateFailed'))),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => specialRequestTypesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setDetailItem(null);
      message.success(t('admin.specialRequestTypes.deactivated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.deactivateFailed'))),
  });

  const openDetail = (item: SpecialRequestTypeDto) => {
    setDetailItem(item);
    setEditing(false);
  };

  const renderProcessTags = (ids: string[]) => {
    if (!ids || ids.length === 0) return <Text type="secondary">—</Text>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ids.map((id) => {
          const proc = processMap.get(id);
          return <Tag key={id} color="blue">{proc ? `${proc.code} — ${proc.name}` : id.slice(0, 8)}</Tag>;
        })}
      </div>
    );
  };

  const columns = [
    {
      title: t('common:labels.code'),
      dataIndex: 'code',
      sorter: (a: SpecialRequestTypeDto, b: SpecialRequestTypeDto) => a.code.localeCompare(b.code),
    },
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: (a: SpecialRequestTypeDto, b: SpecialRequestTypeDto) => a.name.localeCompare(b.name),
    },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: unknown, record: SpecialRequestTypeDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  // Process rules form items (reused in create & edit)
  const processRuleFields = (
    <>
      <Form.Item name="addsProcesses" label={t('admin.specialRequestTypes.addsProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
      <Form.Item name="removesProcesses" label={t('admin.specialRequestTypes.removesProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
      <Form.Item name="onlyProcesses" label={t('admin.specialRequestTypes.onlyProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
    </>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.specialRequestTypes.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.specialRequestTypes.addType')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => openDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Create Drawer */}
      <Drawer
        title={t('admin.specialRequestTypes.createType')}
        open={createOpen}
        onClose={() => { createForm.resetFields(); setCreateOpen(false); }}
        width={Math.min(480, window.innerWidth)}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common:labels.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{t('admin.specialRequestTypes.processRules')}</Text>
          {processRuleFields}
        </Form>
      </Drawer>

      {/* Detail / Edit Drawer */}
      <Drawer
        title={currentDetail ? `${currentDetail.code} — ${currentDetail.name}` : ''}
        open={!!detailItem}
        onClose={() => { setDetailItem(null); setEditing(false); editForm.resetFields(); }}
        width={Math.min(480, window.innerWidth)}
        extra={
          editing ? (
            <Space>
              <Button onClick={() => {
                setEditing(false);
                if (currentDetail) editForm.setFieldsValue({
                  name: currentDetail.name,
                  description: currentDetail.description,
                  addsProcesses: currentDetail.addsProcesses,
                  removesProcesses: currentDetail.removesProcesses,
                  onlyProcesses: currentDetail.onlyProcesses,
                });
              }}>{t('common:actions.cancel')}</Button>
              <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => {
                if (currentDetail) editForm.setFieldsValue({
                  name: currentDetail.name,
                  description: currentDetail.description,
                  addsProcesses: currentDetail.addsProcesses,
                  removesProcesses: currentDetail.removesProcesses,
                  onlyProcesses: currentDetail.onlyProcesses,
                });
                setEditing(true);
              }}>{t('common:actions.edit')}</Button>
              {currentDetail?.isActive && (
                <Popconfirm
                  title={t('admin.specialRequestTypes.deactivateConfirm')}
                  okText={t('common:actions.confirm')}
                  cancelText={t('common:actions.no')}
                  onConfirm={() => deactivateMutation.mutate(currentDetail!.id)}
                >
                  <Button danger loading={deactivateMutation.isPending}>{t('admin.specialRequestTypes.deactivate')}</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {currentDetail && (
          editing ? (
            <Form
              form={editForm}
              layout="vertical"
              onFinish={(v) => updateMutation.mutate({ id: currentDetail.id, values: v })}
            >
              <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label={t('common:labels.description')}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{t('admin.specialRequestTypes.processRules')}</Text>
              {processRuleFields}
            </Form>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.code')}</Text>
                  <Text strong>{currentDetail.code}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.status')}</Text>
                  <Tag color={currentDetail.isActive ? 'green' : 'default'}>
                    {currentDetail.isActive ? t('common:status.active') : t('common:status.inactive')}
                  </Tag>
                </div>
              </div>

              {currentDetail.description && (
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.description')}</Text>
                  <Text>{currentDetail.description}</Text>
                </div>
              )}

              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{t('admin.specialRequestTypes.processRules')}</Text>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('admin.specialRequestTypes.addsProcesses')}</Text>
                {renderProcessTags(currentDetail.addsProcesses)}
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('admin.specialRequestTypes.removesProcesses')}</Text>
                {renderProcessTags(currentDetail.removesProcesses)}
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('admin.specialRequestTypes.onlyProcesses')}</Text>
                {renderProcessTags(currentDetail.onlyProcesses)}
              </div>
            </>
          )
        )}
      </Drawer>
    </div>
  );
}
