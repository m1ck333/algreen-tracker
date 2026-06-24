import { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useFilterWidth } from '../../hooks/useFilterWidth';
import { Typography, Table, Button, Drawer, Form, Input, Select, Tag, Switch, App, Popconfirm, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderTypesApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import type { OrderTypeDto, DeleteOrderTypeResult } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { PageHeader } from '../../components/PageHeader';
import { getTranslatedError } from '../../utils/errors';
import { useFixedColumn } from '../../hooks/useFixedColumn';

const { Text } = Typography;

export function OrderTypesPage() {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
  const tenantId = useAuthStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<OrderTypeDto | null>(null);
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
  const [sortBy, setSortBy] = useState<string | undefined>('name');
  const [sortDirection, setSortDirection] = useState<string | undefined>('asc');

  useEffect(() => { setPage(1); }, [debouncedSearch, isActiveFilter, dateFrom, dateTo]);

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['order-types', tenantId, debouncedSearch, isActiveFilter, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => orderTypesApi.getAll({
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
  const currentDetail = detailItem ? data?.find((item) => item.id === detailItem.id) ?? detailItem : null;

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      orderTypesApi.create({
        name: values.name as string,
        allowsManualProcesses: !!values.allowsManualProcesses,
      }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['order-types'] });
      setCreateOpen(false);
      createForm.resetFields();
      message.success(t('admin.orderTypes.created'));
      const newItem = resp.data as OrderTypeDto;
      if (newItem?.id) setDetailItem(newItem);
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.orderTypes.createFailed'))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      orderTypesApi.update(id, {
        name: values.name as string,
        allowsManualProcesses: !!values.allowsManualProcesses,
        isActive: !!values.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-types'] });
      message.success(t('admin.orderTypes.updated'));
      markEditClean();
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.orderTypes.updateFailed'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orderTypesApi.delete(id).then((r) => r.data as DeleteOrderTypeResult),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['order-types'] });
      setDetailItem(null);
      if (result?.hardDeleted) {
        message.success(t('admin.orderTypes.deletedHard'));
      } else {
        message.info(t('admin.orderTypes.deletedSoft'));
      }
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('admin.orderTypes.deleteFailed'))),
  });

  useEffect(() => {
    if (currentDetail) {
      editForm.setFieldsValue({
        name: currentDetail.name,
        allowsManualProcesses: currentDetail.allowsManualProcesses,
        isActive: currentDetail.isActive,
      });
    }
  }, [currentDetail, editForm]);

  const columns = [
    {
      title: t('common:labels.name'),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortBy === 'name' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
      fixed: fixedCol('left'),
      width: 240,
    },
    {
      title: t('admin.orderTypes.allowsManualProcesses'),
      dataIndex: 'allowsManualProcesses',
      width: 180,
      render: (v: boolean) => (
        <Tag color={v ? 'blue' : 'default'}>{v ? t('common:actions.yes') : t('common:actions.no')}</Tag>
      ),
    },
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

  const exportColumns: ExportColumn<OrderTypeDto>[] = [
    { header: t('common:labels.name'), value: (s) => s.name, width: 28 },
    {
      header: t('admin.orderTypes.allowsManualProcesses'),
      value: (s) => (s.allowsManualProcesses ? t('common:actions.yes') : t('common:actions.no')),
      width: 22,
    },
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

  const fetchAll = async (): Promise<OrderTypeDto[]> => {
    const { data } = await orderTypesApi.getAll({
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
        title={t('admin.orderTypes.title')}
        actions={<><div style={{ display: 'flex', gap: 8 }}>
          <TableExportButton
            onFetchAll={fetchAll}
            columns={exportColumns}
            options={{
              fileName: `order-types-${dayjs().format('YYYY-MM-DD')}`,
              title: `${t('common:appName')} — ${t('admin.orderTypes.title')}`,
              filters: exportFilters,
              sheetName: t('admin.orderTypes.title'),
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('admin.orderTypes.addType')}
          </Button>
        </div></>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 , flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: filterW(260) }}
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
            const newField = (s?.order ? (s.field as string) : undefined) ?? 'name';
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
            onClick: () => setDetailItem(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Create Drawer */}
      <Drawer
        title={t('admin.orderTypes.createType')}
        open={createOpen}
        onClose={(e) => guardedCreateClose(() => { createForm.resetFields(); setCreateOpen(false); }, e)}
        width={Math.min(480, window.innerWidth)}
        extra={
          <Button type="primary" onClick={() => createForm.submit()} loading={createMutation.isPending}>{t('common:actions.save')}</Button>
        }
      >
        <Form
          form={createForm}
          layout="vertical"
          scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
          initialValues={{ allowsManualProcesses: false }}
          onFinish={(v) => createMutation.mutate(v)}
          onValuesChange={onCreateValuesChange}
        >
          <Form.Item name="name" label={t('common:labels.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="allowsManualProcesses"
            label={t('admin.orderTypes.allowsManualProcesses')}
            valuePropName="checked"
            extra={t('admin.orderTypes.allowsManualProcessesHelp')}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail / Edit Drawer */}
      <Drawer
        title={currentDetail ? currentDetail.name : ''}
        open={!!detailItem}
        onClose={(e) => guardedEditClose(() => { setDetailItem(null); editForm.resetFields(); }, e)}
        width={Math.min(480, window.innerWidth)}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            {currentDetail && (
              <Popconfirm
                title={t('admin.orderTypes.deleteConfirm')}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.no')}
                onConfirm={() => deleteMutation.mutate(currentDetail.id)}
              >
                <Button danger loading={deleteMutation.isPending}>{t('admin.orderTypes.delete')}</Button>
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
              <Form.Item
                name="allowsManualProcesses"
                label={t('admin.orderTypes.allowsManualProcesses')}
                valuePropName="checked"
                extra={t('admin.orderTypes.allowsManualProcessesHelp')}
              >
                <Switch />
              </Form.Item>
              <Form.Item name="isActive" label={t('common:labels.status')} valuePropName="checked">
                <Switch checkedChildren={t('common:status.active')} unCheckedChildren={t('common:status.inactive')} />
              </Form.Item>
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
