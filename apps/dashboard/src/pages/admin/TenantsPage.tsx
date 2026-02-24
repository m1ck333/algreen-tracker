import { useState } from 'react';
import {
  Typography, Table, Button, Drawer, Form, Input, InputNumber, Tag, Space, App,
  Switch, Divider, ColorPicker,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@algreen/api-client';
import type { TenantDto } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

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

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTenant, setDetailTenant] = useState<TenantDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantsApi.getAll().then((r) => r.data.items),
  });

  // Refresh detail from list data
  const currentDetail = detailTenant ? data?.find((item) => item.id === detailTenant.id) ?? detailTenant : null;

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['tenant-settings', currentDetail?.id],
    queryFn: () => tenantsApi.getSettings(currentDetail!.id).then((r) => r.data),
    enabled: !!currentDetail,
  });

  const createMutation = useMutation({
    mutationFn: (values: { name: string; code: string }) => tenantsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.tenants.created'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.tenants.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; isActive: boolean } }) =>
      tenantsApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setEditing(false);
      message.success(t('admin.tenants.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.tenants.updateFailed'))),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      tenantsApi.updateSettings(id, {
        defaultWarningDays: values.defaultWarningDays as number,
        defaultCriticalDays: values.defaultCriticalDays as number,
        warningColor: typeof values.warningColor === 'string' ? values.warningColor : (values.warningColor as { toHexString: () => string })?.toHexString?.() ?? '#faad14',
        criticalColor: typeof values.criticalColor === 'string' ? values.criticalColor : (values.criticalColor as { toHexString: () => string })?.toHexString?.() ?? '#cf1322',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setEditingSettings(false);
      message.success(t('admin.tenants.settingsUpdated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.tenants.settingsUpdateFailed'))),
  });

  const openDetail = (tenant: TenantDto) => {
    setDetailTenant(tenant);
    setEditing(false);
    setEditingSettings(false);
  };

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: (a: TenantDto, b: TenantDto) => a.name.localeCompare(b.name),
    },
    {
      title: t('common:labels.code'),
      dataIndex: 'code',
      sorter: (a: TenantDto, b: TenantDto) => a.code.localeCompare(b.code),
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: unknown, record: TenantDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      sorter: (a: TenantDto, b: TenantDto) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (d: string) => dayjs(d).format('DD.MM.YYYY. HH:mm'),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.tenants.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.tenants.addTenant')}
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
        title={t('admin.tenants.createTenant')}
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
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail / Edit Drawer */}
      <Drawer
        title={currentDetail ? currentDetail.name : ''}
        open={!!detailTenant}
        onClose={() => { setDetailTenant(null); setEditing(false); setEditingSettings(false); editForm.resetFields(); settingsForm.resetFields(); }}
        width={Math.min(480, window.innerWidth)}
        extra={
          editing ? (
            <Space>
              <Button onClick={() => {
                setEditing(false);
                if (currentDetail) editForm.setFieldsValue({ name: currentDetail.name, isActive: currentDetail.isActive });
              }}>{t('common:actions.cancel')}</Button>
              <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
            </Space>
          ) : (
            <Button onClick={() => {
              if (currentDetail) editForm.setFieldsValue({ name: currentDetail.name, isActive: currentDetail.isActive });
              setEditing(true);
            }}>{t('common:actions.edit')}</Button>
          )
        }
      >
        {currentDetail && (
          <>
            {editing ? (
              <Form
                form={editForm}
                layout="vertical"
                onFinish={(v) => updateMutation.mutate({ id: currentDetail.id, values: v })}
              >
                <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
                  <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
                </Form.Item>
              </Form>
            ) : (
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
                {currentDetail.createdAt && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.created')}</Text>
                    <Text>{dayjs(currentDetail.createdAt).format('DD.MM.YYYY. HH:mm')}</Text>
                  </div>
                )}
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Settings section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>{t('admin.tenants.settings')}</Title>
              {!editingSettings ? (
                <Button size="small" onClick={() => {
                  if (settings) {
                    settingsForm.setFieldsValue({
                      defaultWarningDays: settings.defaultWarningDays,
                      defaultCriticalDays: settings.defaultCriticalDays,
                      warningColor: settings.warningColor,
                      criticalColor: settings.criticalColor,
                    });
                  }
                  setEditingSettings(true);
                }}>{t('common:actions.edit')}</Button>
              ) : (
                <Space>
                  <Button size="small" onClick={() => setEditingSettings(false)}>{t('common:actions.cancel')}</Button>
                  <Button size="small" type="primary" onClick={() => settingsForm.submit()} loading={updateSettingsMutation.isPending}>{t('common:actions.save')}</Button>
                </Space>
              )}
            </div>

            {settingsLoading ? (
              <Text type="secondary">{t('common:messages.loading')}</Text>
            ) : editingSettings ? (
              <Form
                form={settingsForm}
                layout="vertical"
                onFinish={(v) => updateSettingsMutation.mutate({ id: currentDetail.id, values: v })}
              >
                <Form.Item name="defaultWarningDays" label={t('admin.tenants.defaultWarningDays')} rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="defaultCriticalDays" label={t('admin.tenants.defaultCriticalDays')} rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="warningColor" label={t('admin.tenants.warningColor')}>
                  <ColorPicker />
                </Form.Item>
                <Form.Item name="criticalColor" label={t('admin.tenants.criticalColor')}>
                  <ColorPicker />
                </Form.Item>
              </Form>
            ) : settings ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('admin.tenants.defaultWarningDays')}</Text>
                  <Text strong>{settings.defaultWarningDays}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('admin.tenants.defaultCriticalDays')}</Text>
                  <Text strong>{settings.defaultCriticalDays}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('admin.tenants.warningColor')}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: settings.warningColor, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <Text>{settings.warningColor}</Text>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('admin.tenants.criticalColor')}</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: settings.criticalColor, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <Text>{settings.criticalColor}</Text>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Drawer>
    </div>
  );
}
