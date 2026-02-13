import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, TimePicker, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

export function ShiftsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', tenantId],
    queryFn: () => shiftsApi.getAll(tenantId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
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
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.shifts.created'));
    },
  });

  const columns = [
    { title: t('common:labels.name'), dataIndex: 'name' },
    { title: t('common:labels.start'), dataIndex: 'startTime' },
    { title: t('common:labels.end'), dataIndex: 'endTime' },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.shifts.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.shifts.addShift')}
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Drawer
        title={t('admin.shifts.createShift')}
        open={drawerOpen}
        onClose={() => { form.resetFields(); setDrawerOpen(false); }}
        width={400}
        extra={
          <Space>
            <Button onClick={() => { form.resetFields(); setDrawerOpen(false); }}>{t('common:actions.cancel')}</Button>
            <Button type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
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
    </div>
  );
}
