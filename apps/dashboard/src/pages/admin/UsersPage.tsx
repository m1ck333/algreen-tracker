import { useState, useEffect, useMemo } from 'react';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, App, Switch, DatePicker, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
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
  const resp = (error as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
  if (resp?.code) {
    const translated = t(`common:errors.${resp.code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return resp?.message || fallback;
}

export function UsersPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();
  const { guardedClose: guardedCreateClose, onValuesChange: onCreateValuesChange } = useUnsavedChanges(createOpen);
  const { guardedClose: guardedEditClose, onValuesChange: onEditValuesChange } = useUnsavedChanges(!!editUser);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>('lastName');
  const [sortDirection, setSortDirection] = useState<string | undefined>('asc');

  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter, isActiveFilter, dateFrom, dateTo]);

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['users', tenantId, debouncedSearch, roleFilter, isActiveFilter, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => usersApi.getAll({
      tenantId: tenantId!,
      search: debouncedSearch || undefined,
      role: roleFilter,
      isActive: isActiveFilter,
      createdFrom: dateFrom?.format('YYYY-MM-DD'),
      createdTo: dateTo?.format('YYYY-MM-DD'),
      page,
      pageSize,
      sortBy,
      sortDirection,
    }).then((r) => r.data),
    enabled: !!tenantId,
  });

  const data = pagedResult?.items;

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll({ tenantId: tenantId!, pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const processMap = useMemo(() => {
    const map = new Map<string, ProcessDto>();
    (processes ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [processes]);

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      usersApi.create({
        tenantId: tenantId!,
        email: values.email as string,
        password: values.password as string,
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: values.role as UserRole,
        processIds: values.role === UserRole.Department && (values.processIds as string[])?.length ? values.processIds as string[] : undefined,
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
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      await usersApi.update(id, {
        tenantId: tenantId!,
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: values.role as UserRole,
        isActive: values.isActive as boolean,
        canIncludeWithdrawnInAnalysis: values.canIncludeWithdrawnInAnalysis as boolean,
        processIds: values.role === UserRole.Department && (values.processIds as string[])?.length ? values.processIds as string[] : undefined,
      });
      const newPassword = (values.newPassword as string)?.trim();
      if (newPassword) {
        await usersApi.resetPassword(id, newPassword);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      editForm.resetFields();
      message.success(t('admin.users.updated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.users.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      editForm.resetFields();
      message.success(t('admin.users.deleted'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.users.deleteFailed'))),
  });

  const openEdit = (user: UserDto) => {
    setEditUser(user);
    editForm.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      processIds: user.processes?.map((p) => p.processId) ?? [],
      isActive: user.isActive,
      canIncludeWithdrawnInAnalysis: user.canIncludeWithdrawnInAnalysis,
    });
  };

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'fullName',
      sorter: true,
      sortOrder: sortBy === 'lastName' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
    },
    {
      title: t('common:labels.email'),
      dataIndex: 'email',
      sorter: true,
      sortOrder: sortBy === 'email' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
    },
    {
      title: t('common:labels.role'),
      dataIndex: 'role',
      render: (r: UserRole) => <Tag>{tEnum('UserRole', r)}</Tag>,
    },
    {
      title: t('admin.users.process'),
      key: 'process',
      render: (_: unknown, record: UserDto) => {
        if (!record.processes?.length) return '—';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {record.processes.map((p) => {
              const proc = processMap.get(p.processId);
              return proc ? <Tag key={p.processId} color="blue">{proc.code} — {proc.name}</Tag> : null;
            })}
          </div>
        );
      },
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      sorter: true,
      sortOrder: sortBy === 'createdAt' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
      render: (d: string) => dayjs(d).format('DD.MM.YYYY.'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('admin.users.title')}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          {t('admin.users.addUser')}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Select
          placeholder={t('common:labels.role')}
          allowClear
          value={roleFilter}
          onChange={(v) => setRoleFilter(v)}
          style={{ width: 160 }}
          options={Object.values(UserRole).map((r) => ({ label: tEnum('UserRole', r), value: r }))}
        />
        <Select
          placeholder={t('common:labels.status')}
          allowClear
          value={isActiveFilter}
          onChange={(v) => setIsActiveFilter(v)}
          style={{ width: 150 }}
          options={[
            { label: t('common:status.active'), value: true },
            { label: t('common:status.inactive'), value: false },
          ]}
        />
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateFrom')}
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateTo')}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          pagination={{
            current: page,
            pageSize,
            total: pagedResult?.totalCount,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize ?? 20);
              setPage(1);
              return;
            }
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const rawField = s?.order ? (s.field as string) : undefined;
            const newField = (rawField === 'fullName' ? 'lastName' : rawField) ?? 'lastName';
            const newDir = (s?.order === 'descend' ? 'desc' : s?.order === 'ascend' ? 'asc' : undefined) ?? 'asc';
            if (newField !== sortBy || newDir !== sortDirection) {
              setSortBy(newField);
              setSortDirection(newDir);
              setPage(1);
              return;
            }
            if (pagination.current !== page) setPage(pagination.current ?? 1);
          }}
          onRow={(record) => ({
            onClick: () => openEdit(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Create User Drawer */}
      <Drawer
        title={t('admin.users.createUser')}
        open={createOpen}
        onClose={(e) => guardedCreateClose(() => { createForm.resetFields(); setCreateOpen(false); }, e)}
        width={400}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form form={createForm} layout="vertical" scrollToFirstError={{ behavior: "smooth", block: "center" }} onFinish={(v) => createMutation.mutate(v)} onValuesChange={onCreateValuesChange}>
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
              onChange={() => createForm.setFieldValue('processIds', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue('role') === UserRole.Department ? (
                <Form.Item name="processIds" label={t('admin.users.process')} rules={[{ required: true }]}>
                  <Select
                    mode="multiple"
                    showSearch
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
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
        onClose={(e) => guardedEditClose(() => { editForm.resetFields(); setEditUser(null); }, e)}
        width={400}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {editUser?.id !== currentUserId && (
              <Popconfirm
                title={t('admin.users.deleteConfirm')}
                onConfirm={() => deleteMutation.mutate(editUser!.id)}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>{t('common:actions.delete')}</Button>
              </Popconfirm>
            )}
            <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
          </div>
        }
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => updateMutation.mutate({ id: editUser!.id, values: v })}
          onValuesChange={onEditValuesChange}
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
              onChange={() => editForm.setFieldValue('processIds', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue('role') === UserRole.Department ? (
                <Form.Item name="processIds" label={t('admin.users.process')} rules={[{ required: true }]}>
                  <Select
                    mode="multiple"
                    showSearch
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={(processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
                    placeholder={t('admin.users.selectProcess')}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="newPassword" label={t('admin.users.newPassword')} rules={[{ min: 6 }]}>
            <Input.Password placeholder={t('admin.users.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
            <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
          </Form.Item>
          <Form.Item name="canIncludeWithdrawnInAnalysis" label={t('admin.users.canIncludeWithdrawn')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        {editUser?.updatedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('common:labels.updated')}: {dayjs(editUser.updatedAt).format('DD.MM.YYYY.')}
          </Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
