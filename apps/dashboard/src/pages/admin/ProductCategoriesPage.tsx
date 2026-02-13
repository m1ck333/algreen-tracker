import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Table, Button, Drawer, Form, Input, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productCategoriesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { ProductCategoryDto } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function ProductCategoriesPage() {
  const navigate = useNavigate();
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['product-categories', tenantId],
    queryFn: () => productCategoriesApi.getAll(tenantId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      productCategoriesApi.create({ tenantId: tenantId!, ...values }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.productCategories.created'));
      navigate(`/admin/product-categories/${resp.data.id}`);
    },
  });

  const columns = [
    { title: t('common:labels.name'), dataIndex: 'name' },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
    {
      title: t('common:labels.actions'),
      render: (_: unknown, record: ProductCategoryDto) => (
        <Button type="link" onClick={() => navigate(`/admin/product-categories/${record.id}`)}>
          {t('common:actions.configure')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.productCategories.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.productCategories.addCategory')}
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Drawer
        title={t('admin.productCategories.createCategory')}
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
          <Form.Item name="description" label={t('common:labels.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
