import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, TimePicker, Tag, App, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { ShiftDto } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

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

export function ShiftsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editShift, setEditShift] = useState<ShiftDto | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', tenantId],
    queryFn: () => shiftsApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (values: { name: string; startTime: dayjs.Dayjs; endTime: dayjs.Dayjs }) =>
      shiftsApi.create({
        tenantId: tenantId!,
        name: values.name,
        startTime: values.startTime.format('HH:mm:ss'),
        endTime: values.endTime.format('HH:mm:ss'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.shifts.created'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.shifts.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; startTime: dayjs.Dayjs; endTime: dayjs.Dayjs; isActive: boolean } }) =>
      shiftsApi.update(id, {
        name: values.name,
        startTime: values.startTime.format('HH:mm:ss'),
        endTime: values.endTime.format('HH:mm:ss'),
        isActive: values.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setEditShift(null);
      editForm.resetFields();
      message.success(t('admin.shifts.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.shifts.updateFailed'))),
  });

  const openEdit = (shift: ShiftDto) => {
    setEditShift(shift);
    editForm.setFieldsValue({
      name: shift.name,
      startTime: dayjs(shift.startTime, 'HH:mm:ss'),
      endTime: dayjs(shift.endTime, 'HH:mm:ss'),
      isActive: shift.isActive,
    });
  };

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: (a: ShiftDto, b: ShiftDto) => a.name.localeCompare(b.name),
    },
    {
      title: t('admin.shifts.startTime'),
      dataIndex: 'startTime',
      width: 120,
      render: (time: string) => time.slice(0, 5),
    },
    {
      title: t('admin.shifts.endTime'),
      dataIndex: 'endTime',
      width: 120,
      render: (time: string) => time.slice(0, 5),
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: unknown, record: ShiftDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.shifts.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.shifts.addShift')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => openEdit(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Create Drawer */}
      <Drawer
        title={t('admin.shifts.createShift')}
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
          <Form.Item name="startTime" label={t('admin.shifts.startTime')} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endTime" label={t('admin.shifts.endTime')} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        title={t('admin.shifts.editShift')}
        open={!!editShift}
        onClose={() => { editForm.resetFields(); setEditShift(null); }}
        width={400}
        extra={
          <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => updateMutation.mutate({ id: editShift!.id, values: v })}
        >
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="startTime" label={t('admin.shifts.startTime')} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endTime" label={t('admin.shifts.endTime')} rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
            <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
