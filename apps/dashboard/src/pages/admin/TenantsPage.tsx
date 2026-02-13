import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@algreen/api-client';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantsApi.getAll().then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
  });

  const createMutation = useMutation({
    mutationFn: (values: { name: string; code: string }) => tenantsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.tenants.created'));
    },
  });

  const columns = [
    { title: t('common:labels.name'), dataIndex: 'name' },
    { title: t('common:labels.code'), dataIndex: 'code' },
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
        <Title level={4} style={{ margin: 0 }}>{t('admin.tenants.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.tenants.addTenant')}
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Drawer
        title={t('admin.tenants.createTenant')}
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
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
