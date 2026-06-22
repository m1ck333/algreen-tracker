import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Tag, Input, Select } from 'antd';
import { EmptyState } from '../../components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import type { StockBalanceRowDto } from '@alblue/shared-types';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import dayjs from 'dayjs';
import { PageHeader } from '../../components/PageHeader';
import { useFixedColumn } from '../../hooks/useFixedColumn';

export function StockPage() {
  const fixedCol = useFixedColumn();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') as StockBalanceRowDto['status'] | null;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [category, setCategory] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<StockBalanceRowDto['status'] | undefined>(
    initialStatus === 'BelowMin' || initialStatus === 'AboveMax' || initialStatus === 'Ok' ? initialStatus : undefined,
  );

  // Re-apply ?status= when the URL changes — so navigating in from a
  // low-stock notification while already on this page actually shifts the
  // filter (the useState initializer above only runs once).
  useEffect(() => {
    const fromUrl = searchParams.get('status');
    if (fromUrl === 'BelowMin' || fromUrl === 'AboveMax' || fromUrl === 'Ok') {
      setStatusFilter(fromUrl);
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-stock', tenantId],
    queryFn: () => warehouseApi.getStockBalances().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  function statusTag(status: StockBalanceRowDto['status']) {
    switch (status) {
      case 'BelowMin': return <Tag color="red">{t('warehouse.statusBelowMin')}</Tag>;
      case 'AboveMax': return <Tag color="orange">{t('warehouse.statusAboveMax')}</Tag>;
      default: return <Tag color="green">{t('warehouse.statusOk')}</Tag>;
    }
  }

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (category) rows = rows.filter((r) => r.category === category);
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      rows = rows.filter((r) => r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s));
    }
    return rows;
  }, [data, debouncedSearch, category, statusFilter]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.category));
    return Array.from(set).sort().map((k) => ({ label: k, value: k }));
  }, [data]);

  const exportColumns: ExportColumn<StockBalanceRowDto>[] = [
    { header: t('materials.status'), value: (r) => r.status === 'BelowMin' ? t('warehouse.statusBelowMin') : r.status === 'AboveMax' ? t('warehouse.statusAboveMax') : t('warehouse.statusOk'), width: 14 },
    { header: t('warehouse.code'), value: (r) => r.code, width: 12 },
    { header: t('warehouse.name'), value: (r) => r.name, width: 24 },
    { header: t('warehouse.unit'), value: (r) => r.unit, width: 8 },
    { header: t('warehouse.category'), value: (r) => r.category, width: 18 },
    { header: t('warehouse.quantity'), value: (r) => r.quantity, align: 'right', width: 12 },
    { header: t('warehouse.min'), value: (r) => r.minQuantity, align: 'right', width: 8 },
    { header: t('warehouse.max'), value: (r) => r.maxQuantity, align: 'right', width: 8 },
    { header: t('warehouse.unitPrice'), value: (r) => r.latestUnitPrice, align: 'right', width: 14 },
    { header: t('warehouse.totalValue'), value: (r) => r.totalValue, align: 'right', width: 14 },
    { header: t('warehouse.location'), value: (r) => r.location ?? '', width: 14 },
    { header: t('materials.dimX'), value: (r) => r.dimensionX ?? '', align: 'right', width: 10 },
    { header: t('materials.dimY'), value: (r) => r.dimensionY ?? '', align: 'right', width: 10 },
    { header: t('materials.dimZ'), value: (r) => r.dimensionZ ?? '', align: 'right', width: 10 },
    { header: t('warehouse.notes'), value: (r) => r.notes ?? '', width: 24 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={t('warehouse.stockTitle')}
        actions={<><TableExportButton
            onFetchAll={async () => filtered}
            columns={exportColumns}
            options={{
              fileName: `warehouse-stock-${dayjs().format('YYYY-MM-DD')}`,
              title: t('warehouse.stockTitle'),
              sheetName: t('warehouse.stockTitle'),
            }}
          /></>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 , flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('warehouse.searchPlaceholder')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Select
          allowClear
          placeholder={t('warehouse.allCategories')}
          style={{ width: 200 }}
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
        <Select
          allowClear
          placeholder={t('warehouse.allStatuses')}
          style={{ width: 200 }}
          options={[
            { label: t('warehouse.statusBelowMin'), value: 'BelowMin' },
            { label: t('warehouse.statusAboveMax'), value: 'AboveMax' },
            { label: t('warehouse.statusOk'), value: 'Ok' },
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StockBalanceRowDto['status'] | undefined)}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table<StockBalanceRowDto>
          loading={isLoading}
          dataSource={filtered}
          rowKey="materialId"
          size="middle"
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          locale={{
            emptyText: (
              <EmptyState
                description={t('warehouse.stockEmpty')}
                action={
                  // Only suggest the materials shortcut when no filters are
                  // applied — otherwise the empty state is "your filter
                  // matched nothing", not "you have no materials".
                  !debouncedSearch && !category && !statusFilter
                    ? {
                        label: t('warehouse.stockEmptyAction'),
                        onClick: () => navigate('/admin/materials'),
                      }
                    : undefined
                }
              />
            ),
          }}
          columns={[
            {
              title: t('warehouse.code'),
              dataIndex: 'code',
              width: 110,
              fixed: fixedCol('left'),
              sorter: (a, b) => a.code.localeCompare(b.code, 'sr-RS'),
            },
            {
              title: t('warehouse.name'),
              dataIndex: 'name',
              width: 240,
              fixed: fixedCol('left'),
              sorter: (a, b) => a.name.localeCompare(b.name, 'sr-RS'),
            },
            {
              title: t('materials.status'),
              dataIndex: 'status',
              width: 140,
              align: 'center' as const,
              render: statusTag,
              sorter: (a, b) => a.status.localeCompare(b.status),
            },
            { title: t('warehouse.unit'), dataIndex: 'unit', width: 70, align: 'center' as const },
            {
              title: t('warehouse.category'),
              dataIndex: 'category',
              width: 160,
              sorter: (a, b) => (a.category ?? '').localeCompare(b.category ?? '', 'sr-RS'),
            },
            {
              title: t('warehouse.quantity'),
              dataIndex: 'quantity',
              width: 110,
              align: 'right' as const,
              sorter: (a, b) => a.quantity - b.quantity,
              render: (v: number) => v.toLocaleString('sr-RS'),
            },
            {
              title: t('warehouse.min'),
              dataIndex: 'minQuantity',
              width: 80,
              align: 'right' as const,
              sorter: (a, b) => a.minQuantity - b.minQuantity,
            },
            {
              title: t('warehouse.max'),
              dataIndex: 'maxQuantity',
              width: 80,
              align: 'right' as const,
              sorter: (a, b) => a.maxQuantity - b.maxQuantity,
            },
            {
              title: t('warehouse.unitPrice'),
              dataIndex: 'latestUnitPrice',
              width: 120,
              align: 'right' as const,
              sorter: (a, b) => a.latestUnitPrice - b.latestUnitPrice,
              render: (v: number) => v.toLocaleString('sr-RS', { minimumFractionDigits: 2 }),
            },
            {
              title: t('warehouse.totalValue'),
              dataIndex: 'totalValue',
              width: 130,
              align: 'right' as const,
              sorter: (a, b) => a.totalValue - b.totalValue,
              render: (v: number) => v.toLocaleString('sr-RS', { minimumFractionDigits: 2 }),
            },
            {
              title: t('warehouse.location'),
              dataIndex: 'location',
              width: 120,
              sorter: (a, b) => (a.location ?? '').localeCompare(b.location ?? '', 'sr-RS'),
              render: (v: string | null) => v || '—',
            },
            {
              title: t('materials.dimX'),
              dataIndex: 'dimensionX',
              width: 80,
              align: 'right' as const,
              sorter: (a, b) => (a.dimensionX ?? 0) - (b.dimensionX ?? 0),
              render: (v: number | null) => (v == null ? '—' : v.toLocaleString('sr-RS')),
            },
            {
              title: t('materials.dimY'),
              dataIndex: 'dimensionY',
              width: 80,
              align: 'right' as const,
              sorter: (a, b) => (a.dimensionY ?? 0) - (b.dimensionY ?? 0),
              render: (v: number | null) => (v == null ? '—' : v.toLocaleString('sr-RS')),
            },
            {
              title: t('materials.dimZ'),
              dataIndex: 'dimensionZ',
              width: 80,
              align: 'right' as const,
              sorter: (a, b) => (a.dimensionZ ?? 0) - (b.dimensionZ ?? 0),
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
