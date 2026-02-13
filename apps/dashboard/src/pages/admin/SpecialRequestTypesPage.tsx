import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specialRequestTypesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function SpecialRequestTypesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['special-request-types', tenantId],
    queryFn: () => specialRequestTypesApi.getAll(tenantId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (values: { code: string; name: string; description?: string }) =>
      specialRequestTypesApi.create({ tenantId: tenantId!, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.specialRequestTypes.created'));
    },
  });

  const columns = [
    { title: t('common:labels.code'), dataIndex: 'code' },
    { title: t('common:labels.name'), dataIndex: 'name' },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
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
        <Title level={4} style={{ margin: 0 }}>{t('admin.specialRequestTypes.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.specialRequestTypes.addType')}
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Drawer
        title={t('admin.specialRequestTypes.createType')}
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
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common:labels.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
