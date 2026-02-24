import { useState } from 'react';
import {
  Typography, Table, Button, Drawer, Form, Input, InputNumber, Tag, Space, App,
  Popconfirm, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { ProcessDto, SubProcessDto } from '@algreen/shared-types';
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

export function ProcessesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailProcess, setDetailProcess] = useState<ProcessDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingSubProcess, setAddingSubProcess] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [subProcessForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // Refresh detail from list data
  const currentDetail = detailProcess ? data?.find((p) => p.id === detailProcess.id) ?? detailProcess : null;

  const createMutation = useMutation({
    mutationFn: (values: { code: string; name: string; sequenceOrder: number }) =>
      processesApi.create({ tenantId: tenantId!, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.processes.created'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.processes.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; sequenceOrder: number } }) =>
      processesApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setEditing(false);
      message.success(t('admin.processes.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.processes.updateFailed'))),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => processesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setDetailProcess(null);
      message.success(t('admin.processes.deactivated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.processes.deactivateFailed'))),
  });

  const addSubMutation = useMutation({
    mutationFn: ({ processId, values }: { processId: string; values: { name: string; sequenceOrder: number } }) =>
      processesApi.addSubProcess(processId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      subProcessForm.resetFields();
      setAddingSubProcess(false);
      message.success(t('admin.processes.subProcessAdded'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.processes.subProcessAddFailed'))),
  });

  const deactivateSubMutation = useMutation({
    mutationFn: ({ processId, subProcessId }: { processId: string; subProcessId: string }) =>
      processesApi.deactivateSubProcess(processId, subProcessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      message.success(t('admin.processes.subProcessDeactivated'));
    },
  });

  const openDetail = (process: ProcessDto) => {
    setDetailProcess(process);
    setEditing(false);
    setAddingSubProcess(false);
  };

  const columns = [
    {
      title: t('common:labels.code'),
      dataIndex: 'code',
      sorter: (a: ProcessDto, b: ProcessDto) => a.code.localeCompare(b.code),
    },
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: (a: ProcessDto, b: ProcessDto) => a.name.localeCompare(b.name),
    },
    {
      title: t('admin.processes.sequenceOrder'),
      dataIndex: 'sequenceOrder',
      width: 100,
      sorter: (a: ProcessDto, b: ProcessDto) => a.sequenceOrder - b.sequenceOrder,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: t('admin.processes.subProcesses'),
      dataIndex: 'subProcesses',
      width: 120,
      render: (subs: SubProcessDto[]) => subs.filter((s) => s.isActive).length,
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: unknown, record: ProcessDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  const activeSubs = (currentDetail?.subProcesses ?? [])
    .filter((s) => s.isActive)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.processes.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.processes.addProcess')}
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

      {/* Create Process Drawer */}
      <Drawer
        title={t('admin.processes.createProcess')}
        open={createOpen}
        onClose={() => { createForm.resetFields(); setCreateOpen(false); }}
        width={400}
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
          <Form.Item name="sequenceOrder" label={t('admin.processes.sequenceOrder')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail / Edit Drawer */}
      <Drawer
        title={currentDetail ? `${currentDetail.code} — ${currentDetail.name}` : ''}
        open={!!detailProcess}
        onClose={() => { setDetailProcess(null); setEditing(false); setAddingSubProcess(false); editForm.resetFields(); subProcessForm.resetFields(); }}
        width={Math.min(520, window.innerWidth)}
        extra={
          editing ? (
            <Space>
              <Button onClick={() => {
                setEditing(false);
                if (currentDetail) editForm.setFieldsValue({ name: currentDetail.name, sequenceOrder: currentDetail.sequenceOrder });
              }}>{t('common:actions.cancel')}</Button>
              <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => {
                if (currentDetail) editForm.setFieldsValue({ name: currentDetail.name, sequenceOrder: currentDetail.sequenceOrder });
                setEditing(true);
              }}>{t('common:actions.edit')}</Button>
              {currentDetail?.isActive && (
                <Popconfirm
                  title={t('admin.processes.deactivateConfirm')}
                  okText={t('common:actions.confirm')}
                  cancelText={t('common:actions.no')}
                  onConfirm={() => deactivateMutation.mutate(currentDetail!.id)}
                >
                  <Button danger loading={deactivateMutation.isPending}>{t('admin.processes.deactivate')}</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {currentDetail && (
          <>
            {/* Edit form / Read-only info */}
            {editing ? (
              <Form
                form={editForm}
                layout="vertical"
                onFinish={(v) => updateMutation.mutate({ id: currentDetail.id, values: v })}
              >
                <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="sequenceOrder" label={t('admin.processes.sequenceOrder')} rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            ) : (
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.code')}</Text>
                  <Text strong>{currentDetail.code}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('admin.processes.sequenceOrder')}</Text>
                  <Text strong>{currentDetail.sequenceOrder}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t('common:labels.status')}</Text>
                  <Tag color={currentDetail.isActive ? 'green' : 'default'}>
                    {currentDetail.isActive ? t('common:status.active') : t('common:status.inactive')}
                  </Tag>
                </div>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Sub-processes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('admin.processes.subProcesses')} ({activeSubs.length})
              </Title>
              {!addingSubProcess && currentDetail.isActive && (
                <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingSubProcess(true)}>
                  {t('admin.processes.addSubProcess')}
                </Button>
              )}
            </div>

            {addingSubProcess && (
              <>
                <Form
                  form={subProcessForm}
                  layout="vertical"
                  size="middle"
                  onFinish={(v) => addSubMutation.mutate({ processId: currentDetail.id, values: v })}
                >
                  <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="sequenceOrder" label={t('admin.processes.sequenceOrder')} rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Space style={{ marginBottom: 12 }}>
                    <Button type="primary" htmlType="submit" loading={addSubMutation.isPending}>{t('common:actions.save')}</Button>
                    <Button onClick={() => { setAddingSubProcess(false); subProcessForm.resetFields(); }}>{t('common:actions.cancel')}</Button>
                  </Space>
                </Form>
                <Divider style={{ margin: '8px 0' }} />
              </>
            )}

            {activeSubs.length > 0 ? (
              <Table
                dataSource={activeSubs}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: t('common:labels.name'), dataIndex: 'name' },
                  {
                    title: t('admin.processes.sequenceOrder'),
                    dataIndex: 'sequenceOrder',
                    width: 100,
                  },
                  {
                    title: '',
                    width: 40,
                    render: (_: unknown, sub: SubProcessDto) => (
                      <Popconfirm
                        title={t('admin.processes.deactivateSubConfirm')}
                        okText={t('common:actions.confirm')}
                        cancelText={t('common:actions.no')}
                        onConfirm={() => deactivateSubMutation.mutate({ processId: currentDetail.id, subProcessId: sub.id })}
                      >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            ) : (
              <Text type="secondary">{t('admin.processes.noSubProcesses')}</Text>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
