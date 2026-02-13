import { useState } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, Space, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { UserRole } from '@algreen/shared-types';
import type { UserDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function UsersPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => usersApi.getAll(tenantId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      usersApi.create({
        tenantId: tenantId!,
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role as UserRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDrawerOpen(false);
      form.resetFields();
      message.success(t('admin.users.created'));
    },
  });

  const columns = [
    { title: t('common:labels.name'), dataIndex: 'fullName' },
    { title: t('common:labels.email'), dataIndex: 'email' },
    { title: t('common:labels.role'), dataIndex: 'role', render: (r: UserRole) => <Tag>{tEnum('UserRole', r)}</Tag> },
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
        <Title level={4} style={{ margin: 0 }}>{t('admin.users.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          {t('admin.users.addUser')}
        </Button>
      </div>

      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />

      <Drawer
        title={t('admin.users.createUser')}
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
          <Form.Item name="email" label={t('common:labels.email')} rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={t('common:labels.password')} rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="firstName" label={t('common:labels.firstName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label={t('common:labels.lastName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label={t('common:labels.role')} rules={[{ required: true }]}>
            <Select
              options={Object.values(UserRole).map((r) => ({ label: tEnum('UserRole', r), value: r }))}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
