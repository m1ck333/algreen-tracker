import { useState, useMemo } from 'react';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, App, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { UserRole } from '@algreen/shared-types';
import type { UserDto, ProcessDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
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

export function UsersPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () => usersApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const processMap = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    (processes ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [processes]);

  const createMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      usersApi.create({
        tenantId: tenantId!,
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role as UserRole,
        processId: values.role === UserRole.Department ? values.processId : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.users.created'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.users.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      usersApi.update(id, {
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: values.role as UserRole,
        isActive: values.isActive as boolean,
        canIncludeWithdrawnInAnalysis: values.canIncludeWithdrawnInAnalysis as boolean,
        processId: values.role === UserRole.Department ? (values.processId as string) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      editForm.resetFields();
      message.success(t('admin.users.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.users.updateFailed'))),
  });

  const openEdit = (user: UserDto) => {
    setEditUser(user);
    editForm.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      processId: user.processId,
      isActive: user.isActive,
      canIncludeWithdrawnInAnalysis: user.canIncludeWithdrawnInAnalysis,
    });
  };

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'fullName',
      sorter: (a: UserDto, b: UserDto) => a.fullName.localeCompare(b.fullName),
    },
    {
      title: t('common:labels.email'),
      dataIndex: 'email',
    },
    {
      title: t('common:labels.role'),
      dataIndex: 'role',
      filters: Object.values(UserRole).map((r) => ({ text: tEnum('UserRole', r), value: r })),
      onFilter: (value: unknown, record: UserDto) => record.role === value,
      render: (r: UserRole) => <Tag>{tEnum('UserRole', r)}</Tag>,
    },
    {
      title: t('admin.users.process'),
      key: 'process',
      render: (_: unknown, record: UserDto) => {
        if (!record.processId) return '—';
        const proc = processMap.get(record.processId);
        return proc ? <Tag color="blue">{proc.code} — {proc.name}</Tag> : '—';
      },
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      filters: [
        { text: t('common:status.active'), value: true },
        { text: t('common:status.inactive'), value: false },
      ],
      onFilter: (value: unknown, record: UserDto) => record.isActive === value,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      sorter: (a: UserDto, b: UserDto) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (d: string) => dayjs(d).format('DD.MM.YYYY. HH:mm'),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.users.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.users.addUser')}
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

      {/* Create User Drawer */}
      <Drawer
        title={t('admin.users.createUser')}
        open={createOpen}
        onClose={() => { createForm.resetFields(); setCreateOpen(false); }}
        width={400}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
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
              onChange={() => createForm.setFieldValue('processId', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue('role') === UserRole.Department ? (
                <Form.Item name="processId" label={t('admin.users.process')} rules={[{ required: true }]}>
                  <Select
                    options={(processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
                    placeholder={t('admin.users.selectProcess')}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Drawer>

      {/* Edit User Drawer */}
      <Drawer
        title={t('admin.users.editUser')}
        open={!!editUser}
        onClose={() => { editForm.resetFields(); setEditUser(null); }}
        width={400}
        extra={
          <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => updateMutation.mutate({ id: editUser!.id, values: v })}
        >
          <Form.Item name="firstName" label={t('common:labels.firstName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label={t('common:labels.lastName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label={t('common:labels.role')} rules={[{ required: true }]}>
            <Select
              options={Object.values(UserRole).map((r) => ({ label: tEnum('UserRole', r), value: r }))}
              onChange={() => editForm.setFieldValue('processId', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue('role') === UserRole.Department ? (
                <Form.Item name="processId" label={t('admin.users.process')} rules={[{ required: true }]}>
                  <Select
                    options={(processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
                    placeholder={t('admin.users.selectProcess')}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
            <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
          </Form.Item>
          <Form.Item name="canIncludeWithdrawnInAnalysis" label={t('admin.users.canIncludeWithdrawn')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
