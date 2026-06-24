import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, App, Switch, DatePicker, Popconfirm, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, processesApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { UserRole } from '@alblue/shared-types';
import type { UserDto, ProcessDto } from '@alblue/shared-types';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { PageHeader } from '../../components/PageHeader';
import { getTranslatedError } from '../../utils/errors';
import { passwordRules } from '../../utils/password';
import { useFixedColumn } from '../../hooks/useFixedColumn';
import { useFilterWidth } from '../../hooks/useFilterWidth';


/**
 * Compact list of recent login attempts (success + failure) for the
 * currently-open user. Same lazy-load pattern as the role-history
 * section. Failure reasons render as small red tags; successes as
 * green. IP + user-agent shown beneath the title to help an admin
 * spot weird origins.
 */
function LoginHistorySection({ userId }: { userId: string }) {
  const { t } = useTranslation('dashboard');
  const { data, isLoading } = useQuery({
    queryKey: ['user-login-history', userId],
    queryFn: () => usersApi.getLoginHistory(userId, 20).then((r) => r.data),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return (
    <div>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
        {t('admin.users.loginHistory')}
      </Typography.Text>
      {isLoading && <Typography.Text type="secondary" style={{ fontSize: 12 }}>…</Typography.Text>}
      {!isLoading && (!data || data.length === 0) && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('admin.users.loginHistoryEmpty')}
        </Typography.Text>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
          {data.map((entry) => (
            <li key={entry.id} style={{ marginBottom: 6 }}>
              <div>
                {entry.succeeded ? (
                  <Tag color="green" style={{ fontSize: 11 }}>{t('admin.users.loginSucceeded')}</Tag>
                ) : (
                  <Tag color="red" style={{ fontSize: 11 }}>
                    {entry.failureReason ?? t('admin.users.loginFailed')}
                  </Tag>
                )}
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(entry.attemptedAt).format('DD.MM.YYYY. HH:mm')}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
              </Typography.Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Compact list of role changes for the currently-open user. Lives at the
 * bottom of the edit drawer — collapses to "no changes recorded" for
 * users who never had their role mutated. Loads lazily when the drawer
 * opens (the query is keyed on userId; React Query caches per user).
 */
function RoleHistorySection({ userId }: { userId: string }) {
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['user-role-history', userId],
    queryFn: () => usersApi.getRoleHistory(userId).then((r) => r.data),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return (
    <div>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
        {t('admin.users.roleHistory')}
      </Typography.Text>
      {isLoading && <Typography.Text type="secondary" style={{ fontSize: 12 }}>…</Typography.Text>}
      {!isLoading && (!data || data.length === 0) && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('admin.users.roleHistoryEmpty')}
        </Typography.Text>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
          {data.map((entry) => (
            <li key={entry.id} style={{ marginBottom: 6 }}>
              <div>
                {t('admin.users.roleHistoryEntry', {
                  oldRole: tEnum('UserRole', entry.oldRole),
                  newRole: tEnum('UserRole', entry.newRole),
                })}
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(entry.changedAt).format('DD.MM.YYYY. HH:mm')} ·{' '}
                {t('admin.users.roleHistoryBy', { actor: entry.changedByUserName ?? '—' })}
              </Typography.Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface UsersPageProps {
  /** When true, suppress the top PageHeader — used when embedding as a
   *  tab panel inside KorisniciPage so the parent owns the header. */
  hideHeader?: boolean;
}

export function UsersPage({ hideHeader = false }: UsersPageProps = {}) {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
  const tenantId = useAuthStore((s) => s.tenantId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = currentUserRole === UserRole.SuperAdmin;
  // SuperAdmin is intentionally NOT in the dropdown for anyone — that role
  // is platform-level and only granted directly via DB (Milos 12.06.2026).
  // BE rejects the role with FORBIDDEN_ROLE_ASSIGNMENT as defense-in-depth.
  const assignableRoles = Object.values(UserRole).filter((r) => r !== UserRole.SuperAdmin);
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
    queryFn: () => processesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
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
        firstName: values.firstName as string,
        lastName: values.lastName as string,
        role: values.role as UserRole,
        isActive: values.isActive as boolean,
        canIncludeWithdrawnInAnalysis: values.canIncludeWithdrawnInAnalysis as boolean,
        processIds: values.role === UserRole.Department && (values.processIds as string[])?.length ? values.processIds as string[] : undefined,
        // Saša 08.06.2026 — extra roles beyond primary (e.g. Coordinator +
        // Magacioner). Send the array unconditionally so clearing is
        // explicit; BE keys off non-null to know "user touched this field".
        additionalRoles: (values.additionalRoles as UserRole[] | undefined) ?? [],
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
      additionalRoles: user.additionalRoles ?? [],
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
      fixed: fixedCol('left'),
      width: 220,
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

  // ─── Export ──────────────────────────────────────────────
  const exportColumns: ExportColumn<UserDto>[] = [
    { header: t('common:labels.firstName'), value: (u) => u.firstName, width: 16 },
    { header: t('common:labels.lastName'), value: (u) => u.lastName, width: 16 },
    { header: t('common:labels.email'), value: (u) => u.email, width: 28 },
    { header: t('common:labels.role'), value: (u) => tEnum('UserRole', u.role), width: 16 },
    {
      header: t('admin.users.process'),
      value: (u) =>
        (u.processes ?? [])
          .map((p) => {
            const proc = processMap.get(p.processId);
            return proc ? `${proc.code} — ${proc.name}` : '';
          })
          .filter(Boolean)
          .join(', '),
      width: 32,
    },
    {
      header: t('common:labels.status'),
      value: (u) => (u.isActive ? t('common:status.active') : t('common:status.inactive')),
      cell: (u) => (u.isActive ? { fillColor: '#D9F2D9' } : { fillColor: '#F5F5F5' }),
      width: 14,
    },
    {
      header: t('common:labels.created'),
      value: (u) => (u.createdAt ? new Date(u.createdAt) : null),
      width: 18,
    },
  ];
  const exportFilters: Array<{ label: string; value: string }> = [];
  if (debouncedSearch) exportFilters.push({ label: t('export.search'), value: debouncedSearch });
  if (roleFilter) exportFilters.push({ label: t('export.role'), value: tEnum('UserRole', roleFilter as UserRole) });
  if (isActiveFilter !== undefined) {
    exportFilters.push({
      label: t('export.isActive'),
      value: isActiveFilter ? t('common:status.active') : t('common:status.inactive'),
    });
  }
  if (dateFrom) exportFilters.push({ label: t('export.dateFrom'), value: dateFrom.format('DD.MM.YYYY.') });
  if (dateTo) exportFilters.push({ label: t('export.dateTo'), value: dateTo.format('DD.MM.YYYY.') });

  const fetchAllUsers = async (): Promise<UserDto[]> => {
    const { data } = await usersApi.getAll({
      search: debouncedSearch || undefined,
      role: roleFilter,
      isActive: isActiveFilter,
      createdFrom: dateFrom?.format('YYYY-MM-DD'),
      createdTo: dateTo?.format('YYYY-MM-DD'),
      page: 1,
      pageSize: 10000,
      sortBy,
      sortDirection,
    });
    return data.items;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {!hideHeader && (
        <PageHeader
          title={t('admin.users.title')}
          actions={<><div style={{ display: 'flex', gap: 8 }}>
            <TableExportButton
              onFetchAll={fetchAllUsers}
              columns={exportColumns}
              options={{
                fileName: `users-${dayjs().format('YYYY-MM-DD')}`,
                title: `${t('common:appName')} — ${t('admin.users.title')}`,
                filters: exportFilters,
                sheetName: t('admin.users.title'),
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('admin.users.addUser')}
            </Button>
          </div></>}
        />
      )}
      {hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <TableExportButton
            onFetchAll={fetchAllUsers}
            columns={exportColumns}
            options={{
              fileName: `users-${dayjs().format('YYYY-MM-DD')}`,
              title: `${t('common:appName')} — ${t('admin.users.title')}`,
              filters: exportFilters,
              sheetName: t('admin.users.title'),
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('admin.users.addUser')}
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 , flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: filterW(260) }}
        />
        <Select
          placeholder={t('common:labels.role')}
          allowClear
          value={roleFilter}
          onChange={(v) => setRoleFilter(v)}
          style={{ width: filterW(160) }}
          options={Object.values(UserRole).map((r) => ({ label: tEnum('UserRole', r), value: r }))}
        />
        <Select
          placeholder={t('common:labels.status')}
          allowClear
          value={isActiveFilter}
          onChange={(v) => setIsActiveFilter(v)}
          style={{ width: filterW(150) }}
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
          <Form.Item name="password" label={t('common:labels.password')} rules={passwordRules(t)}>
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
              options={assignableRoles.map((r) => ({ label: tEnum('UserRole', r), value: r }))}
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
            {/* Sprint 3.0 F-7 — only SuperAdmin can change an existing user's
                role. Non-SuperAdmin viewers see the current role as a
                disabled select (so they can read it but not modify). BE
                rejects with FORBIDDEN_ROLE_CHANGE as defense in depth. */}
            <Select
              disabled={!isSuperAdmin}
              options={assignableRoles.map((r) => ({ label: tEnum('UserRole', r), value: r }))}
              onChange={() => editForm.setFieldValue('processIds', undefined)}
            />
          </Form.Item>
          {/* Saša 08.06.2026 — extra roles a user holds in addition to the
              primary. Same SuperAdmin-only gate as primary role. Filtering
              the picker excludes the primary role + SuperAdmin to keep
              "additional" meaningful. */}
          <Form.Item
            name="additionalRoles"
            label={t('admin.users.additionalRoles')}
            tooltip={t('admin.users.additionalRolesHint')}
          >
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
              {({ getFieldValue }) => {
                const primary = getFieldValue('role') as UserRole | undefined;
                // SuperAdmin is already excluded from assignableRoles
                // upstream — just drop the primary role here so it can't
                // also be picked as an additional one.
                const options = assignableRoles
                  .filter((r) => r !== primary)
                  .map((r) => ({ label: tEnum('UserRole', r), value: r }));
                return (
                  <Select
                    mode="multiple"
                    disabled={!isSuperAdmin}
                    options={options}
                    placeholder={t('admin.users.additionalRolesPlaceholder')}
                  />
                );
              }}
            </Form.Item>
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
          <Form.Item name="newPassword" label={t('admin.users.newPassword')} rules={passwordRules(t, { required: false })}>
            <Input.Password placeholder={t('admin.users.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
            <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
          </Form.Item>
          <Form.Item name="canIncludeWithdrawnInAnalysis" label={t('admin.users.canIncludeWithdrawn')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        {editUser && (
          <>
            <Divider style={{ margin: '16px 0 8px' }} />
            <RoleHistorySection userId={editUser.id} />
            <Divider style={{ margin: '16px 0 8px' }} />
            <LoginHistorySection userId={editUser.id} />
          </>
        )}
        {editUser?.updatedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('common:labels.updated')}: {dayjs(editUser.updatedAt).format('DD.MM.YYYY.')}
          </Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
