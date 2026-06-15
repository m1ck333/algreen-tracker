import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, App, Popconfirm, Divider, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specialRequestTypesApi, processesApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import type { SpecialRequestTypeDto } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { PageHeader } from '../../components/PageHeader';
import { getTranslatedError } from '../../utils/errors';

const { Text } = Typography;

export function SpecialRequestTypesPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SpecialRequestTypeDto | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');

  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();
  const { guardedClose: guardedCreateClose, onValuesChange: onCreateValuesChange } = useUnsavedChanges(createOpen);
  const { guardedClose: guardedEditClose, onValuesChange: onEditValuesChange, markClean: markEditClean } = useUnsavedChanges(!!detailItem);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>('code');
  const [sortDirection, setSortDirection] = useState<string | undefined>('asc');

  useEffect(() => { setPage(1); }, [debouncedSearch, isActiveFilter, dateFrom, dateTo]);

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['special-request-types', tenantId, debouncedSearch, isActiveFilter, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => specialRequestTypesApi.getAll({
      search: debouncedSearch || undefined,
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
    enabled: !!tenantId && (!!detailItem || createOpen),
  });

  const processOptions = (processes ?? []).map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }));

  // Refresh detail from list data
  const currentDetail = detailItem ? data?.find((item) => item.id === detailItem.id) ?? detailItem : null;

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      specialRequestTypesApi.create({
        code: values.code as string,
        name: values.name as string,
        description: values.description as string | undefined,
        addsProcesses: values.addsProcesses as string[] | undefined,
        removesProcesses: values.removesProcesses as string[] | undefined,
        onlyProcesses: values.onlyProcesses as string[] | undefined,
      }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.specialRequestTypes.created'));
      // Open detail drawer for the newly created item
      const newItem = resp.data as SpecialRequestTypeDto;
      if (newItem?.id) setDetailItem(newItem);
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      specialRequestTypesApi.update(id, {
        name: values.name as string,
        description: values.description as string | undefined,
        addsProcesses: values.addsProcesses as string[] | undefined,
        removesProcesses: values.removesProcesses as string[] | undefined,
        onlyProcesses: values.onlyProcesses as string[] | undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      message.success(t('admin.specialRequestTypes.updated'));
      markEditClean();
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.updateFailed'))),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => specialRequestTypesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setDetailItem(null);
      message.success(t('admin.specialRequestTypes.deactivated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.deactivateFailed'))),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => specialRequestTypesApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-request-types'] });
      setDetailItem(null);
      message.success(t('admin.specialRequestTypes.activated'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.specialRequestTypes.activateFailed'))),
  });

  const openDetail = (item: SpecialRequestTypeDto) => {
    setDetailItem(item);
  };

  // Auto-populate edit form when detail loads
  useEffect(() => {
    if (currentDetail) {
      editForm.setFieldsValue({
        name: currentDetail.name,
        description: currentDetail.description,
        addsProcesses: currentDetail.addsProcesses,
        removesProcesses: currentDetail.removesProcesses,
        onlyProcesses: currentDetail.onlyProcesses,
      });
    }
  }, [currentDetail, editForm]);

  const columns = [
    {
      title: t('common:labels.code'),
      dataIndex: 'code',
      sorter: true,
      sortOrder: sortBy === 'code' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
      fixed: 'left' as const,
      width: 120,
    },
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortBy === 'name' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
      fixed: 'left' as const,
      width: 240,
    },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      render: (d: string) => d ? dayjs(d).format('DD.MM.YYYY.') : '—',
      sorter: true,
      sortOrder: sortBy === 'createdAt' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'isActive',
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? t('common:status.active') : t('common:status.inactive')}</Tag>
      ),
    },
  ];

  // Process rules form items (reused in create & edit)
  const processRuleFields = (
    <>
      <Form.Item name="addsProcesses" label={t('admin.specialRequestTypes.addsProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
      <Form.Item name="removesProcesses" label={t('admin.specialRequestTypes.removesProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
      <Form.Item name="onlyProcesses" label={t('admin.specialRequestTypes.onlyProcesses')}>
        <Select mode="multiple" options={processOptions} allowClear placeholder={t('admin.specialRequestTypes.selectProcesses')} />
      </Form.Item>
    </>
  );

  const exportColumns: ExportColumn<SpecialRequestTypeDto>[] = [
    { header: t('common:labels.code'), value: (s) => s.code, width: 12 },
    { header: t('common:labels.name'), value: (s) => s.name, width: 28 },
    { header: t('common:labels.description'), value: (s) => s.description ?? '', width: 32 },
    {
      header: t('common:labels.status'),
      value: (s) => (s.isActive ? t('common:status.active') : t('common:status.inactive')),
      cell: (s) => (s.isActive ? { fillColor: '#D9F2D9' } : { fillColor: '#F5F5F5' }),
      width: 14,
    },
    { header: t('common:labels.created'), value: (s) => (s.createdAt ? new Date(s.createdAt) : null), width: 18 },
  ];
  const exportFilters: Array<{ label: string; value: string }> = [];
  if (debouncedSearch) exportFilters.push({ label: t('export.search'), value: debouncedSearch });
  if (isActiveFilter !== undefined) exportFilters.push({ label: t('export.isActive'), value: isActiveFilter ? t('common:status.active') : t('common:status.inactive') });
  if (dateFrom) exportFilters.push({ label: t('export.dateFrom'), value: dateFrom.format('DD.MM.YYYY.') });
  if (dateTo) exportFilters.push({ label: t('export.dateTo'), value: dateTo.format('DD.MM.YYYY.') });

  const fetchAllSrt = async (): Promise<SpecialRequestTypeDto[]> => {
    const { data } = await specialRequestTypesApi.getAll({
      search: debouncedSearch || undefined,
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
      <PageHeader
        title={t('admin.specialRequestTypes.title')}
        actions={<><div style={{ display: 'flex', gap: 8 }}>
          <TableExportButton
            onFetchAll={fetchAllSrt}
            columns={exportColumns}
            options={{
              fileName: `special-request-types-${dayjs().format('YYYY-MM-DD')}`,
              title: `${t('common:appName')} — ${t('admin.specialRequestTypes.title')}`,
              filters: exportFilters,
              sheetName: t('admin.specialRequestTypes.title'),
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('admin.specialRequestTypes.addType')}
          </Button>
        </div></>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 , flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
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
            const newField = (s?.order ? (s.field as string) : undefined) ?? 'code';
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
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Create Drawer */}
      <Drawer
        title={t('admin.specialRequestTypes.createType')}
        open={createOpen}
        onClose={(e) => guardedCreateClose(() => { createForm.resetFields(); setCreateOpen(false); }, e)}
        width={Math.min(480, window.innerWidth)}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form form={createForm} layout="vertical" scrollToFirstError={{ behavior: "smooth", block: "center" }} onFinish={(v) => createMutation.mutate(v)} onValuesChange={onCreateValuesChange}>
          <Form.Item name="code" label={t('common:labels.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common:labels.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {processRuleFields}
        </Form>
      </Drawer>

      {/* Detail / Edit Drawer */}
      <Drawer
        title={currentDetail ? `${currentDetail.code} — ${currentDetail.name}` : ''}
        open={!!detailItem}
        onClose={(e) => guardedEditClose(() => { setDetailItem(null); editForm.resetFields(); }, e)}
        width={Math.min(480, window.innerWidth)}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {currentDetail?.isActive ? (
              <Popconfirm
                title={t('admin.specialRequestTypes.deactivateConfirm')}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.no')}
                onConfirm={() => deactivateMutation.mutate(currentDetail!.id)}
              >
                <Button danger loading={deactivateMutation.isPending}>{t('admin.specialRequestTypes.deactivate')}</Button>
              </Popconfirm>
            ) : currentDetail && (
              <Popconfirm
                title={t('admin.specialRequestTypes.activateConfirm')}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.no')}
                onConfirm={() => activateMutation.mutate(currentDetail.id)}
              >
                <Button type="primary" ghost loading={activateMutation.isPending}>{t('admin.specialRequestTypes.activate')}</Button>
              </Popconfirm>
            )}
            <Button type="primary" onClick={() => editForm.submit()} loading={updateMutation.isPending}>{t('common:actions.save')}</Button>
          </div>
        }
      >
        {currentDetail && (
          <>
            <Form
              form={editForm}
              layout="vertical"
              onFinish={(v) => updateMutation.mutate({ id: currentDetail.id, values: v })}
              onValuesChange={onEditValuesChange}
            >
              <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label={t('common:labels.description')}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Divider style={{ margin: '12px 0' }} />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>{t('admin.specialRequestTypes.processRules')}</Text>
              {processRuleFields}
            </Form>
            {currentDetail.updatedAt && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                {t('common:labels.updated')}: {dayjs(currentDetail.updatedAt).format('DD.MM.YYYY.')}
              </Text>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
