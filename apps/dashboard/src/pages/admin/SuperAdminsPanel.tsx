import { useState } from 'react';
import { Table, Button, Drawer, Form, Input, App, Tag, Typography, Select, Tooltip } from 'antd';
import { PlusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, tenantsApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { UserRole } from '@alblue/shared-types';
import type { UserDto } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { passwordRules } from '../../utils/password';
import { getTranslatedError } from '../../utils/errors';

/**
 * "Sistem administratori" tab body (UsersPage tab 2). SuperAdmin-only.
 *
 * Intentionally minimal: list + create. No edit, no delete, no password
 * reset rows — peer SuperAdmin protection on the BE makes those impossible
 * anyway (see CreateUser / UpdateUser / DeleteUser / ResetPassword
 * handlers). To "remove" a SuperAdmin they self-deactivate from their own
 * profile, or it's a DB intervention — both intentional friction.
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

  // Tenant lookup — drives both the picker in the create drawer and the
  // "Firma" column in the list (id → name + code). Fetched eagerly because
  // the column needs it on first render, not just when the drawer opens.
  const { data: tenantsPage } = useQuery({
    queryKey: ['tenants', 'all-for-superadmin-picker'],
    queryFn: () => tenantsApi.getAll({ page: 1, pageSize: 1000 }).then((r) => r.data),
  });
  const tenants = tenantsPage?.items ?? [];
  const tenantById = new Map(tenants.map((tn) => [tn.id, tn]));

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      usersApi.create({
        tenantId: values.tenantId as string,
        email: values.email as string,
        password: values.password as string,
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: UserRole.SuperAdmin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] });
      message.success(t('admin.systemAdmins.created', { defaultValue: 'Super administrator kreiran' }));
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.systemAdmins.createFailed', { defaultValue: 'Greška pri kreiranju' }))),
  });

  const columns = [
    {
      title: t('common:labels.email'),
      dataIndex: 'email',
      render: (email: string, record: UserDto) => (
        <span>
          {email}
          {record.id === currentUserId && (
            <Tag color="blue" style={{ marginLeft: 8 }}>{t('admin.systemAdmins.you', { defaultValue: 'Vi' })}</Tag>
          )}
        </span>
      ),
    },
    {
      title: t('common:labels.name'),
      render: (_: unknown, r: UserDto) => `${r.firstName} ${r.lastName}`,
    },
    {
      title: t('admin.systemAdmins.homeTenant', { defaultValue: 'Matična firma' }),
      dataIndex: 'tenantId',
      render: (tenantId: string) => {
        const tn = tenantById.get(tenantId);
        return tn ? `${tn.name} (${tn.code})` : '—';
      },
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
        {t('admin.systemAdmins.help', {
          defaultValue:
            'Super administrator može kreirati nove naloge. Niko ne može menjati, brisati ili resetovati lozinku drugog super administratora — vlasnik to radi preko svog profila.',
        })}
      </Typography.Paragraph>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.systemAdmins.add', { defaultValue: 'Dodaj super administratora' })}
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
        title={t('admin.systemAdmins.add', { defaultValue: 'Dodaj super administratora' })}
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
          <Form.Item
            name="tenantId"
            label={
              <span>
                {t('admin.systemAdmins.homeTenant', { defaultValue: 'Matična firma' })}
                <Tooltip
                  title={t('admin.systemAdmins.homeTenantHelp', {
                    defaultValue:
                      'U izabranoj firmi super administrator ima sva prava — može da menja podatke, kreira korisnike, itd. U svim ostalim firmama može samo da gleda preko prijave sa kodom druge firme. Izbor ne ograničava koje firme može da vidi, samo gde može da menja.',
                  })}
                >
                  <InfoCircleOutlined style={{ marginLeft: 6, color: '#1677ff' }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: t('admin.systemAdmins.homeTenantRequired', { defaultValue: 'Izaberi firmu' }) }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('admin.systemAdmins.homeTenantPlaceholder', { defaultValue: 'Izaberi firmu' })}
              options={tenants.map((tn) => ({ value: tn.id, label: `${tn.name} (${tn.code})` }))}
            />
          </Form.Item>
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
