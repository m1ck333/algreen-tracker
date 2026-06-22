import { useState } from 'react';
import { Table, Tag, DatePicker, Select, Input, Empty } from 'antd';
import type { TablePaginationConfig } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi, materialsApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { StockMovementType } from '@alblue/shared-types';
import type { StockMovementDto } from '@alblue/shared-types';
import { useTableHeight } from '../../hooks/useTableHeight';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import dayjs from 'dayjs';
import { PageHeader } from '../../components/PageHeader';
import { useFixedColumn } from '../../hooks/useFixedColumn';

const { RangePicker } = DatePicker;

export function HistoryPage() {
  const fixedCol = useFixedColumn();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();

  const [type, setType] = useState<StockMovementType | undefined>();
  const [materialId, setMaterialId] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [docRef, setDocRef] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string>('movementDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: materials } = useQuery({
    queryKey: ['materials-for-history', tenantId],
    queryFn: () => materialsApi.getAll({ pageSize: 500 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const queryParams = {
    type,
    materialId,
    category,
    docRef: docRef || undefined,
    from: dateRange[0]?.format('YYYY-MM-DD'),
    to: dateRange[1]?.format('YYYY-MM-DD'),
    sortBy,
    sortDirection,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-history', tenantId, queryParams, page, pageSize],
    queryFn: () => warehouseApi.getStockHistory({ ...queryParams, page, pageSize }).then((r) => r.data),
    enabled: !!tenantId,
  });

  const fetchAll = async (): Promise<StockMovementDto[]> => {
    const { data } = await warehouseApi.getStockHistory({ ...queryParams, page: 1, pageSize: 10000 });
    return data.items;
  };

  const exportColumns: ExportColumn<StockMovementDto>[] = [
    { header: t('warehouse.movementDate'), value: (r) => (r.movementDate ? new Date(r.movementDate) : null), width: 20 },
    { header: t('warehouse.type'), value: (r) => (r.type === 'Inflow' ? t('warehouse.inflowLabel') : t('warehouse.outflowLabel')), width: 12 },
    { header: t('warehouse.code'), value: (r) => r.materialCode, width: 14 },
    { header: t('warehouse.name'), value: (r) => r.materialName, width: 32 },
    { header: t('warehouse.unit'), value: (r) => r.unit, width: 8 },
    { header: t('warehouse.quantity'), value: (r) => (r.type === 'Outflow' ? -r.quantity : r.quantity), width: 12 },
    { header: t('warehouse.category'), value: (r) => r.category, width: 18 },
    { header: t('warehouse.documentReference'), value: (r) => r.documentReference, width: 24 },
    { header: t('warehouse.process'), value: (r) => r.processName ?? '', width: 20 },
    { header: t('warehouse.unitPrice'), value: (r) => r.unitPrice, width: 14 },
    { header: t('warehouse.total'), value: (r) => r.totalPrice, width: 14 },
    { header: t('materials.dimX'), value: (r) => r.dimensionX ?? '', width: 10 },
    { header: t('materials.dimY'), value: (r) => r.dimensionY ?? '', width: 10 },
    { header: t('materials.dimZ'), value: (r) => r.dimensionZ ?? '', width: 10 },
    { header: t('warehouse.notes'), value: (r) => r.notes ?? '', width: 28 },
  ];

  const categoryOptions = Array.from(new Set((materials ?? []).map((m) => m.category).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'sr-RS'))
    .map((c) => ({ label: c, value: c }));

  const exportFilters: Array<{ label: string; value: string }> = [];
  if (type) exportFilters.push({ label: t('export.type'), value: type === StockMovementType.Inflow ? t('warehouse.inflowLabel') : t('warehouse.outflowLabel') });
  if (materialId) {
    const m = materials?.find((x) => x.id === materialId);
    if (m) exportFilters.push({ label: t('warehouse.name'), value: `${m.code} — ${m.name}` });
  }
  if (category) exportFilters.push({ label: t('warehouse.category'), value: category });
  if (docRef) exportFilters.push({ label: t('warehouse.documentReference'), value: docRef });
  if (dateRange[0]) exportFilters.push({ label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') });
  if (dateRange[1]) exportFilters.push({ label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') });

  const sortOrder = (field: string): 'ascend' | 'descend' | null =>
    sortBy === field ? (sortDirection === 'desc' ? 'descend' : 'ascend') : null;

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: unknown,
    sorter: SorterResult<StockMovementDto> | SorterResult<StockMovementDto>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (s?.order && s.field) {
      setSortBy(String(s.field));
      setSortDirection(s.order === 'descend' ? 'desc' : 'asc');
    } else {
      setSortBy('movementDate');
      setSortDirection('desc');
    }
    if (pagination.current) setPage(pagination.current);
    if (pagination.pageSize) setPageSize(pagination.pageSize);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={t('warehouse.historyTitle')}
        actions={<><TableExportButton
          onFetchAll={fetchAll}
          columns={exportColumns}
          options={{
            fileName: `magacin-istorija-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('warehouse.historyTitle')}`,
            filters: exportFilters,
            sheetName: t('warehouse.historyTitle'),
          }}
        /></>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          allowClear
          placeholder={t('warehouse.type')}
          style={{ width: 140 }}
          options={[
            { label: t('warehouse.inflowLabel'), value: StockMovementType.Inflow },
            { label: t('warehouse.outflowLabel'), value: StockMovementType.Outflow },
          ]}
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('warehouse.allMaterials')}
          style={{ width: 260 }}
          options={(materials ?? []).map((m) => ({ label: `${m.code} — ${m.name}`, value: m.id }))}
          value={materialId}
          onChange={(v) => { setMaterialId(v); setPage(1); }}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('warehouse.allCategories')}
          style={{ width: 200 }}
          options={categoryOptions}
          value={category}
          onChange={(v) => { setCategory(v); setPage(1); }}
        />
        <Input
          allowClear
          placeholder={t('warehouse.documentReferenceSearch')}
          style={{ width: 260 }}
          value={docRef}
          onChange={(e) => setDocRef(e.target.value)}
        />
        <RangePicker
          format="DD.MM.YYYY"
          value={dateRange}
          onChange={(v) => { setDateRange((v ?? [null, null]) as [dayjs.Dayjs | null, dayjs.Dayjs | null]); setPage(1); }}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table<StockMovementDto>
          loading={isLoading}
          dataSource={data?.items}
          rowKey="id"
          size="middle"
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          pagination={{
            current: page,
            pageSize,
            total: data?.totalCount,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
          locale={{ emptyText: <Empty description={t('warehouse.historyEmpty')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          columns={[
            {
              title: t('warehouse.movementDate'),
              dataIndex: 'movementDate',
              width: 140,
              fixed: fixedCol('left'),
              sorter: true,
              sortOrder: sortOrder('movementDate'),
              render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
            },
            {
              title: t('warehouse.type'),
              dataIndex: 'type',
              width: 100,
              fixed: fixedCol('left'),
              align: 'center' as const,
              sorter: true,
              sortOrder: sortOrder('type'),
              render: (v: 'Inflow' | 'Outflow') =>
                v === 'Inflow' ? <Tag color="green">{t('warehouse.inflowLabel')}</Tag> : <Tag color="orange">{t('warehouse.outflowLabel')}</Tag>,
            },
            {
              title: t('warehouse.code'),
              dataIndex: 'materialCode',
              width: 100,
              fixed: fixedCol('left'),
              sorter: true,
              sortOrder: sortOrder('materialCode'),
            },
            {
              title: t('warehouse.name'),
              dataIndex: 'materialName',
              width: 240,
              fixed: fixedCol('left'),
              sorter: true,
              sortOrder: sortOrder('materialName'),
            },
            {
              title: t('warehouse.unit'),
              dataIndex: 'unit',
              width: 60,
              align: 'center' as const,
            },
            {
              title: t('warehouse.quantity'),
              dataIndex: 'quantity',
              width: 110,
              align: 'right' as const,
              sorter: true,
              sortOrder: sortOrder('quantity'),
              render: (_, r) => {
                const sign = r.type === 'Outflow' ? '-' : '+';
                return `${sign}${r.quantity.toLocaleString('sr-RS')}`;
              },
            },
            {
              title: t('warehouse.category'),
              dataIndex: 'category',
              width: 140,
              sorter: true,
              sortOrder: sortOrder('category'),
            },
            {
              title: t('warehouse.documentReference'),
              dataIndex: 'documentReference',
              width: 200,
              sorter: true,
              sortOrder: sortOrder('documentReference'),
            },
            {
              title: t('warehouse.process'),
              dataIndex: 'processName',
              width: 200,
              render: (v: string | null) => v || '—',
            },
            {
              title: t('warehouse.unitPrice'),
              dataIndex: 'unitPrice',
              width: 120,
              align: 'right' as const,
              sorter: true,
              sortOrder: sortOrder('unitPrice'),
              render: (v: number) => v.toLocaleString('sr-RS', { minimumFractionDigits: 2 }),
            },
            {
              title: t('warehouse.total'),
              dataIndex: 'totalPrice',
              width: 130,
              align: 'right' as const,
              sorter: true,
              sortOrder: sortOrder('totalPrice'),
              render: (v: number) => v.toLocaleString('sr-RS', { minimumFractionDigits: 2 }),
            },
            {
              title: t('materials.dimX'),
              dataIndex: 'dimensionX',
              width: 80,
              align: 'right' as const,
              render: (v: number | null) => (v == null ? '—' : v.toLocaleString('sr-RS')),
            },
            {
              title: t('materials.dimY'),
              dataIndex: 'dimensionY',
              width: 80,
              align: 'right' as const,
              render: (v: number | null) => (v == null ? '—' : v.toLocaleString('sr-RS')),
            },
            {
              title: t('materials.dimZ'),
              dataIndex: 'dimensionZ',
              width: 80,
              align: 'right' as const,
              render: (v: number | null) => (v == null ? '—' : v.toLocaleString('sr-RS')),
            },
            {
              title: t('warehouse.notes'),
              dataIndex: 'notes',
              render: (v: string | null) => v || '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
