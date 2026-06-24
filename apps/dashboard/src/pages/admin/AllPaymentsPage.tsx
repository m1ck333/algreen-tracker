import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Input, Select, DatePicker, Typography } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { EmptyState } from '../../components/EmptyState';
import { tenantsApi } from '@alblue/api-client';
import type { AllTenantPaymentDto, TenantDto } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import dayjs from 'dayjs';
import { useDebounce } from '../../hooks/useDebounce';
import { useTableHeight } from '../../hooks/useTableHeight';
import { useFilterWidth } from '../../hooks/useFilterWidth';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { paidAtColumn, durationColumn, amountColumn, invoiceColumn, notesColumn } from '../../utils/paymentColumns';

/**
 * "Sve uplate" — SA-only cross-tenant payments view (Saša 17.06.2026
 * feedback #4). Reuses the existing TableExportButton for Excel/CSV
 * output. Tenant filter is populated from the SA Firme list so a SA can
 * scope to a single client without typing the GUID.
 */
export function AllPaymentsPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();
  const filterW = useFilterWidth();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [tenantFilter, setTenantFilter] = useState<string | undefined>(undefined);
  const [paidFrom, setPaidFrom] = useState<dayjs.Dayjs | null>(null);
  const [paidTo, setPaidTo] = useState<dayjs.Dayjs | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string>('paidAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { setPage(1); }, [tenantFilter, paidFrom, paidTo, currencyFilter, debouncedSearch]);

  // Tenant dropdown options — fetched once and cached. Small list (handful
  // of tenants) so paging it is unnecessary.
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-all-for-filter'],
    queryFn: () => tenantsApi.getAll({ page: 1, pageSize: 1000 }).then((r) => r.data.items as TenantDto[]),
  });

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['all-payments', tenantFilter, paidFrom?.format('YYYY-MM-DD'), paidTo?.format('YYYY-MM-DD'), currencyFilter, page, pageSize, sortBy, sortDirection],
    queryFn: () => tenantsApi.listAllPayments({
      tenantId: tenantFilter,
      paidFrom: paidFrom?.format('YYYY-MM-DD'),
      paidTo: paidTo?.format('YYYY-MM-DD'),
      currency: currencyFilter,
      page,
      pageSize,
      sortBy,
      sortDirection,
    }).then((r) => r.data),
  });

  const rawData = pagedResult?.items ?? [];

  // Client-side text search on tenant name / code / invoice number —
  // cheap and keeps the BE endpoint focused.
  const data = debouncedSearch.trim()
    ? rawData.filter((row) => {
        const q = debouncedSearch.trim().toLowerCase();
        return (
          row.tenantName.toLowerCase().includes(q)
          || row.tenantCode.toLowerCase().includes(q)
          || (row.invoiceNumber ?? '').toLowerCase().includes(q)
          || (row.notes ?? '').toLowerCase().includes(q)
        );
      })
    : rawData;

  // Sort orientation helper: maps the server sortBy/sortDirection state
  // onto antd's sortOrder API for each column. Server-side sort lives on
  // the Table's onChange below; columns just need to mark themselves
  // sortable + show the right arrow.
  const sortOrderFor = (key: string) =>
    sortBy === key ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null;
  const colOpts = { t, language: i18n.language, clientSort: false };
  const columns = [
    {
      title: t('admin.tenants.billing.tenant'),
      key: 'tenantName',
      sorter: true,
      sortOrder: sortOrderFor('tenantName'),
      render: (_: unknown, row: AllTenantPaymentDto) => (
        <span>
          <Typography.Text strong>{row.tenantName}</Typography.Text>
          <Typography.Text type="secondary" style={{ marginLeft: 6 }}>· {row.tenantCode}</Typography.Text>
        </span>
      ),
    },
    { ...paidAtColumn<AllTenantPaymentDto>(colOpts), key: 'paidAt', sorter: true, sortOrder: sortOrderFor('paidAt') },
    { ...durationColumn<AllTenantPaymentDto>(colOpts), key: 'periodStart', width: 130, sorter: true, sortOrder: sortOrderFor('periodStart') },
    { ...amountColumn<AllTenantPaymentDto>(colOpts), sorter: true, sortOrder: sortOrderFor('amount') },
    { ...invoiceColumn<AllTenantPaymentDto>(colOpts), key: 'invoiceNumber' },
    { ...notesColumn<AllTenantPaymentDto>(colOpts), key: 'notes' },
  ];

  // Currency dropdown options — derived from existing data so it stays in
  // sync without a separate enum. Falls back to ["EUR"] when the page is
  // empty so the dropdown isn't disabled on first load.
  const knownCurrencies = Array.from(new Set(rawData.map((p) => p.currency)));
  const currencyOptions = knownCurrencies.length > 0
    ? knownCurrencies.map((c) => ({ label: c, value: c }))
    : [{ label: 'EUR', value: 'EUR' }];

  const exportColumns: ExportColumn<AllTenantPaymentDto>[] = [
    { header: t('admin.tenants.billing.tenant'), value: (r) => r.tenantName, width: 28 },
    { header: t('common:labels.code'), value: (r) => r.tenantCode, width: 12 },
    { header: t('admin.tenants.billing.paidAt'), value: (r) => (r.paidAt ? new Date(r.paidAt) : null), width: 14 },
    { header: t('admin.tenants.billing.periodStart'), value: (r) => (r.periodStart ? new Date(r.periodStart) : null), width: 16 },
    { header: t('admin.tenants.billing.periodEnd'), value: (r) => (r.periodEnd ? new Date(r.periodEnd) : null), width: 16 },
    { header: t('admin.tenants.billing.amount'), value: (r) => r.amount, width: 14 },
    { header: t('admin.tenants.billing.currency'), value: (r) => r.currency, width: 10 },
    { header: t('admin.tenants.billing.invoiceNumber'), value: (r) => r.invoiceNumber, width: 18 },
    { header: t('admin.tenants.billing.notes'), value: (r) => r.notes, width: 40 },
  ];

  const exportFilters: Array<{ label: string; value: string }> = [];
  if (tenantFilter) {
    const t2 = tenants.find((x) => x.id === tenantFilter);
    if (t2) exportFilters.push({ label: t('admin.tenants.billing.tenant'), value: `${t2.name} (${t2.code})` });
  }
  if (paidFrom) exportFilters.push({ label: t('common:labels.dateFrom'), value: paidFrom.format('DD.MM.YYYY.') });
  if (paidTo) exportFilters.push({ label: t('common:labels.dateTo'), value: paidTo.format('DD.MM.YYYY.') });
  if (currencyFilter) exportFilters.push({ label: t('admin.tenants.billing.currency'), value: currencyFilter });

  // Export needs the FULL filtered dataset, not the current page. Fetch
  // up to 10k rows from the same endpoint (more than enough for SA-scale
  // history; pagination kicks back in at the UI level).
  const fetchAllForExport = async (): Promise<AllTenantPaymentDto[]> => {
    const { data } = await tenantsApi.listAllPayments({
      tenantId: tenantFilter,
      paidFrom: paidFrom?.format('YYYY-MM-DD'),
      paidTo: paidTo?.format('YYYY-MM-DD'),
      currency: currencyFilter,
      page: 1,
      pageSize: 10000,
      sortBy,
      sortDirection,
    });
    return data.items;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <TableExportButton
          onFetchAll={fetchAllForExport}
          columns={exportColumns}
          options={{
            fileName: `sve-uplate-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('admin.tenants.billing.allPayments')}`,
            filters: exportFilters,
            sheetName: t('admin.tenants.billing.allPayments'),
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: filterW(260) }}
        />
        <Select
          placeholder={t('admin.tenants.billing.tenant')}
          allowClear
          value={tenantFilter}
          onChange={(v) => setTenantFilter(v)}
          style={{ width: filterW(220) }}
          showSearch
          optionFilterProp="label"
          options={tenants.map((tn) => ({ label: `${tn.name} · ${tn.code}`, value: tn.id }))}
        />
        <DatePicker
          value={paidFrom}
          onChange={setPaidFrom}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('admin.tenants.billing.paidFromPlaceholder')}
        />
        <DatePicker
          value={paidTo}
          onChange={setPaidTo}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('admin.tenants.billing.paidToPlaceholder')}
        />
        <Select
          placeholder={t('admin.tenants.billing.currency')}
          allowClear
          value={currencyFilter}
          onChange={(v) => setCurrencyFilter(v)}
          style={{ width: filterW(110) }}
          options={currencyOptions}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table
          size="middle"
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={isLoading}
          locale={{
            emptyText: (() => {
              const hasFilters = !!(debouncedSearch || tenantFilter || paidFrom || paidTo || currencyFilter);
              return (
                <EmptyState
                  description={hasFilters
                    ? t('admin.tenants.billing.noFilteredResults')
                    : t('admin.tenants.billing.noPaymentsAcrossTenants')}
                  action={hasFilters ? {
                    label: t('admin.tenants.clearFilters'),
                    icon: <ClearOutlined />,
                    onClick: () => {
                      setSearch('');
                      setTenantFilter(undefined);
                      setPaidFrom(null);
                      setPaidTo(null);
                      setCurrencyFilter(undefined);
                    },
                  } : undefined}
                />
              );
            })(),
          }}
          // Drop the y-scroll cap when there are no rows so the empty
          // state (description + "Obriši filtere" button) can render at
          // its natural height instead of getting clipped.
          scroll={{ x: 'max-content', y: data.length > 0 ? tableBodyHeight : undefined }}
          pagination={{
            current: page,
            pageSize,
            total: pagedResult?.totalCount,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize ?? 50);
              setPage(1);
              return;
            }
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const newField = (s?.order ? (s.columnKey as string) : undefined) ?? 'paidAt';
            const newDir: 'asc' | 'desc' = s?.order === 'ascend' ? 'asc' : 'desc';
            if (newField !== sortBy || newDir !== sortDirection) {
              setSortBy(newField);
              setSortDirection(newDir);
              setPage(1);
              return;
            }
            if (pagination.current !== page) setPage(pagination.current ?? 1);
          }}
        />
      </div>
    </div>
  );
}
