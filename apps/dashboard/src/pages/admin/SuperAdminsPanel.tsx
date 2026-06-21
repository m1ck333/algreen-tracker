import { useState } from 'react';
import { Table, Button, Drawer, Form, Input, App, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { UserRole } from '@alblue/shared-types';
import type { UserDto } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { passwordRules } from '../../utils/password';
import { getTranslatedError } from '../../utils/errors';

/**
 * "Super administratori" tab body (UsersPage tab 2). SuperAdmin-only.
 *
 * After the 16.06.2026 refactor SuperAdmins are tenantless platform
 * operators — no home tenant column, no tenant picker on Create, no
 * cross-tenant banner. They're always read-only against client data and
 * can only write to platform-level endpoints (tenant CRUD, SA CRUD, own
 * password). The middleware does the heavy lifting; this panel is
 * intentionally a flat list + Create.
 *
 * Self-row is shown with a "Vi" tag so the operator can see themselves
 * in the list (and confirm their email is correct) without confusing the
 * row for "someone I can manage".
 */
export function SuperAdminsPanel() {
  const { t } = useTranslation('dashboard');
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: superAdmins = [], isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: () => usersApi.getSuperAdmins().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      usersApi.create({
        email: values.email as string,
        password: values.password as string,
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: UserRole.SuperAdmin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] });
      message.success(t('admin.systemAdmins.created'));
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.systemAdmins.createFailed'))),
  });

  const columns = [
    {
      title: t('common:labels.email'),
      dataIndex: 'email',
      render: (email: string, record: UserDto) => (
        <span>
          {email}
          {record.id === currentUserId && (
            <Tag color="blue" style={{ marginLeft: 8 }}>{t('admin.systemAdmins.you')}</Tag>
          )}
        </span>
      ),
    },
    {
      title: t('common:labels.name'),
      render: (_: unknown, r: UserDto) => `${r.firstName} ${r.lastName}`,
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? t('common:status.active') : t('common:status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      render: (d: string) => (d ? dayjs(d).format('DD.MM.YYYY.') : ''),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('admin.systemAdmins.help')}
      </Typography.Paragraph>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.systemAdmins.add')}
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={superAdmins}
        pagination={false}
      />

      <Drawer
        title={t('admin.systemAdmins.add')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={Math.min(480, window.innerWidth)}
        extra={
          <Button type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>
            {t('common:actions.save')}
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="email" label={t('common:labels.email')} rules={[{ required: true, type: 'email' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="firstName" label={t('common:labels.firstName')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="lastName" label={t('common:labels.lastName')} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input autoComplete="off" />
            </Form.Item>
          </div>
          <Form.Item name="password" label={t('common:labels.password')} rules={passwordRules(t)}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
