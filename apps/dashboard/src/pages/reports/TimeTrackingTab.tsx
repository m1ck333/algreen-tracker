import { useState, useMemo } from 'react';
import {
  Table,
  Select,
  DatePicker,
  Space,
  Input,
  Switch,
  Tooltip,
  App,
} from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import {
  reportsApi,
  processesApi,
  productCategoriesApi,
  orderTypesApi,
  processWorkflowApi,
} from '@alblue/api-client';
import type {
  TimeTrackingItemDto,
  ProcessDto,
  ProductCategoryDto,
  OrderTypeDto,
} from '@alblue/shared-types';
import { ComplexityType } from '@alblue/shared-types';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import { formatSeconds } from './reportsHelpers';
import { useFilterWidth } from '../../hooks/useFilterWidth';

const { RangePicker } = DatePicker;

export function TimeTrackingTab() {
  const filterW = useFilterWidth();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [processId, setProcessId] = useState<string | undefined>(undefined);
  const [complexity, setComplexity] = useState<string | undefined>(undefined);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  // Per-row exclusion is now server-side (Sale/Bojan feedback 22.05.2026):
  // toggling writes through to the BE so the choice persists across
  // sessions/users and is reflected in /reports/process-times aggregation.
  const queryClient = useQueryClient();

  const { data: processes } = useQuery({
    queryKey: ['processes-for-reports', tenantId],
    queryFn: () => processesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories-for-reports', tenantId],
    queryFn: () =>
      productCategoriesApi.getAll({ pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // Same per-tenant order types as Vremena tab — react-query caches it.
  const { data: orderTypeList } = useQuery({
    queryKey: ['order-types-for-reports', tenantId],
    queryFn: () =>
      orderTypesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // Case-insensitive lookup: the BE's /api/order-types returns `code`
  // upper-cased (STANDARD/REPAIR/etc.) but /api/reports/* returns the C#
  // enum identifier as ToString() (Standard/Repair/etc.). Without lowercase
  // normalization the lookup misses and the table shows the raw enum code
  // instead of the per-tenant configured name (Bojan feedback 24.05.2026).
  const orderTypeNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    orderTypeList?.forEach((ot) => map.set(ot.code.toLowerCase(), ot.name));
    return map;
  }, [orderTypeList]);
  const resolveOrderTypeName = (code: string) =>
    orderTypeNameByCode.get(code.toLowerCase()) ?? code;

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-time-tracking',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      processId,
      complexity,
      orderNumber,
      categoryIds,
      orderTypes,
    ],
    queryFn: () =>
      reportsApi
        .getTimeTracking({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          processId,
          complexity,
          orderNumber: orderNumber.trim() || undefined,
          productCategoryIds: categoryIds.length ? categoryIds : undefined,
          orderTypes: orderTypes.length ? orderTypes : undefined,
        })
        .then((r) => r.data),
    enabled: !!tenantId,
  });

  const items = data?.items ?? [];

  // Mutation: write the new exclusion state to BE. Optimistic — update the
  // cached items array immediately, rollback on error. The BE filters the
  // Vremena (process-times) aggregation by this flag, so we also invalidate
  // that query so Sale/Bojan see the recomputed averages on the other tab.
  // Track in-flight exclusion PATCHes per row so the switch can show a
  // spinner. Without this the optimistic update masks the network round
  // trip — if the BE fails (network blip, 500), the row would silently
  // revert with no visible feedback. The spinner makes the save visible.
  const [pendingExclusionIds, setPendingExclusionIds] = useState<Set<string>>(new Set());

  const { message } = App.useApp();

  const setExcludedMutation = useMutation({
    mutationFn: ({ id, excluded }: { id: string; excluded: boolean }) =>
      processWorkflowApi.setExcludedFromReports(id, excluded),
    onMutate: async ({ id, excluded }) => {
      setPendingExclusionIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      const queryKeyMatches = (qk: unknown) =>
        Array.isArray(qk) && qk[0] === 'reports-time-tracking';
      await queryClient.cancelQueries({ predicate: (q) => queryKeyMatches(q.queryKey) });
      const previous = queryClient.getQueriesData({ predicate: (q) => queryKeyMatches(q.queryKey) });
      queryClient.setQueriesData<{ items: TimeTrackingItemDto[] }>(
        { predicate: (q) => queryKeyMatches(q.queryKey) },
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((i) =>
                  i.orderItemProcessId === id ? { ...i, isExcludedFromReports: excluded } : i,
                ),
              }
            : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach(([key, value]) => queryClient.setQueryData(key, value));
      message.error(t('reports.includeSaveFailed'));
    },
    onSuccess: () => {
      // Recompute Vremena averages on the next render of that tab.
      queryClient.invalidateQueries({ queryKey: ['reports-process-times'] });
    },
    onSettled: (_data, _err, vars) => {
      setPendingExclusionIds((prev) => {
        const next = new Set(prev);
        next.delete(vars.id);
        return next;
      });
    },
  });

  const toggleExclude = (id: string, currentlyExcluded: boolean) =>
    setExcludedMutation.mutate({ id, excluded: !currentlyExcluded });

  const bulkSetExcluded = async (excluded: boolean) => {
    const targets = items.filter((i) => i.isExcludedFromReports !== excluded);
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((i) => setExcludedMutation.mutateAsync({ id: i.orderItemProcessId, excluded })),
    );
  };

  const columns: ColumnsType<TimeTrackingItemDto> = useMemo(
    () => [
      { title: t('reports.orderNumber'), dataIndex: 'orderNumber', width: 130 },
      {
        title: t('reports.productCategory'),
        dataIndex: 'productCategoryName',
        width: 160,
      },
      {
        title: t('reports.orderType'),
        dataIndex: 'orderType',
        width: 110,
        render: (v: string) => resolveOrderTypeName(v),
      },
      {
        title: t('reports.processName'),
        dataIndex: 'processName',
        render: (text: string, record) => `${record.processCode} — ${text}`,
      },
      {
        title: t('reports.complexity'),
        dataIndex: 'complexity',
        width: 110,
        render: (v: string | null) => (v ? tEnum('ComplexityType', v) : '—'),
      },
      {
        title: t('reports.startedAt'),
        dataIndex: 'startedAt',
        width: 145,
        render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—'),
      },
      {
        title: t('reports.completedAt'),
        dataIndex: 'completedAt',
        width: 145,
        render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—'),
      },
      {
        title: t('reports.duration'),
        dataIndex: 'durationSeconds',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.durationSeconds - b.durationSeconds,
        render: (v: number) => formatSeconds(v),
      },
      {
        title: () => {
          const allIncluded =
            items.length > 0 && items.every((i) => !i.isExcludedFromReports);
          return (
            <Space size={6} wrap style={{ justifyContent: 'center' }}>
              <span>{t('reports.include')}</span>
              <Tooltip title={t('reports.includeHelp')}>
                <QuestionCircleOutlined style={{ cursor: 'help', opacity: 0.65 }} />
              </Tooltip>
              <Tooltip title={t('reports.includeBulkHelp')}>
                <Switch
                  size="small"
                  checked={allIncluded}
                  disabled={items.length === 0}
                  onChange={(checked) => bulkSetExcluded(!checked)}
                />
              </Tooltip>
            </Space>
          );
        },
        key: 'include',
        width: 110,
        align: 'center',
        render: (_: unknown, record: TimeTrackingItemDto) => (
          <Switch
            size="small"
            checked={!record.isExcludedFromReports}
            loading={pendingExclusionIds.has(record.orderItemProcessId)}
            onChange={() =>
              toggleExclude(record.orderItemProcessId, record.isExcludedFromReports)
            }
          />
        ),
      },
    ],
    [t, tEnum, items, resolveOrderTypeName, pendingExclusionIds],
  );

  // Sub-process columns mirror only Proces + Trajanje from the parent table.
  // The trailing empty column lines the sub-process Trajanje cells up
  // under the parent table's Trajanje column (parent has Uključi after it).
  // Width here must match parent Uključi column width.
  const subProcessColumns: ColumnsType<TimeTrackingItemDto['subProcesses'][0]> = useMemo(
    () => [
      { title: t('reports.subProcessName'), dataIndex: 'name' },
      {
        title: t('reports.duration'),
        dataIndex: 'durationSeconds',
        width: 110,
        align: 'right',
        render: (v: number) => formatSeconds(v),
      },
      { title: '', key: 'subProcessTrailingSpacer', width: 110, render: () => null },
    ],
    [t],
  );

  // Uključi toggle gates which rows are included in the XLSX export.
  // The totals (ukupno stavki / ukupno vreme / prosečno vreme) used to be
  // shown in a header strip; Sale/Bojan asked to delete them entirely.
  const includedItems = items.filter((i) => !i.isExcludedFromReports);
  // Hide antd's reserved expand-chevron column when no row in the current
  // view has sub-processes — otherwise it shows as an empty first column.
  const hasAnyExpandable = items.some((i) => i.subProcesses.length > 0);

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) setDateRange([vals[0], vals[1]]);
          }}
          format="DD.MM.YYYY"
        />
        <Input
          placeholder={t('reports.orderNumberSearch')}
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          allowClear
          style={{ width: filterW(220) }}
        />
        <Select
          placeholder={t('reports.allProcesses')}
          value={processId}
          onChange={setProcessId}
          allowClear
          style={{ width: filterW(180) }}
          options={processes?.map((p: ProcessDto) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
        />
        <Select
          placeholder={t('reports.allComplexities')}
          value={complexity}
          onChange={setComplexity}
          allowClear
          style={{ width: filterW(160) }}
          options={[
            { label: t('reports.complexityT'), value: ComplexityType.T },
            { label: t('reports.complexityS'), value: ComplexityType.S },
            { label: t('reports.complexityL'), value: ComplexityType.L },
          ]}
        />
        <Select
          mode="multiple"
          placeholder={t('reports.allCategories')}
          value={categoryIds}
          onChange={setCategoryIds}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 220 }}
          maxTagCount={2}
          options={categories?.map((c: ProductCategoryDto) => ({
            label: c.name,
            value: c.id,
          }))}
        />
        <Select
          mode="multiple"
          placeholder={t('reports.allTypes')}
          value={orderTypes}
          onChange={setOrderTypes}
          allowClear
          style={{ minWidth: 180 }}
          options={orderTypeList?.map((ot: OrderTypeDto) => ({
            label: ot.name,
            value: ot.code,
          }))}
        />
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () => includedItems}
          columns={[
            { header: t('reports.orderNumber'), value: (i: TimeTrackingItemDto) => i.orderNumber, width: 16 },
            { header: t('reports.productCategory'), value: (i: TimeTrackingItemDto) => i.productCategoryName, width: 20 },
            { header: t('reports.orderType'), value: (i: TimeTrackingItemDto) => resolveOrderTypeName(i.orderType), width: 14 },
            { header: t('reports.processCode'), value: (i: TimeTrackingItemDto) => i.processCode, width: 12 },
            { header: t('reports.processName'), value: (i: TimeTrackingItemDto) => i.processName, width: 22 },
            { header: t('reports.complexity'), value: (i: TimeTrackingItemDto) => i.complexity ?? '', width: 14 },
            // XLSX gets real Date objects (numFmt 'dd.mm.yyyy hh:mm' applied
            // automatically); CSV path overrides these with pre-formatted strings.
            { header: t('reports.startedAt'), value: (i: TimeTrackingItemDto) => (i.startedAt ? new Date(i.startedAt) : null), width: 18 },
            { header: t('reports.completedAt'), value: (i: TimeTrackingItemDto) => (i.completedAt ? new Date(i.completedAt) : null), width: 18 },
            { header: t('reports.duration'), value: (i: TimeTrackingItemDto) => formatSeconds(i.durationSeconds), align: 'right', width: 12 },
          ]}
          options={{
            fileName: `reports-time-tracking-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabTimeTracking')}`,
            sheetName: t('reports.tabTimeTracking'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
              ...(orderNumber ? [{ label: t('reports.orderNumber'), value: orderNumber }] : []),
              ...(processId ? [{ label: t('reports.processCode'), value: processes?.find((p) => p.id === processId)?.code ?? processId }] : []),
              ...(complexity ? [{ label: t('reports.complexity'), value: complexity }] : []),
              ...(categoryIds.length
                ? [{
                    label: t('reports.productCategory'),
                    value: categories?.filter((c) => categoryIds.includes(c.id)).map((c) => c.name).join(', ') ?? '',
                  }]
                : []),
              ...(orderTypes.length ? [{ label: t('reports.orderType'), value: orderTypes.map(resolveOrderTypeName).join(', ') }] : []),
            ],
          }}
          xlsxExtraSheets={[
            {
              sheetName: t('reports.subProcessSheetName'),
              rowsFor: (mainRows) =>
                mainRows.flatMap((i) =>
                  i.subProcesses.map((sp) => ({
                    orderNumber: i.orderNumber,
                    processCode: i.processCode,
                    processName: i.processName,
                    subProcessName: sp.name,
                    durationSeconds: sp.durationSeconds,
                  })),
                ),
              columns: [
                { header: t('reports.orderNumber'), value: (r: unknown) => (r as { orderNumber: string }).orderNumber, width: 16 },
                { header: t('reports.processCode'), value: (r: unknown) => (r as { processCode: string }).processCode, width: 12 },
                { header: t('reports.processName'), value: (r: unknown) => (r as { processName: string }).processName, width: 22 },
                { header: t('reports.subProcessName'), value: (r: unknown) => (r as { subProcessName: string }).subProcessName, width: 22 },
                { header: t('reports.duration'), value: (r: unknown) => formatSeconds((r as { durationSeconds: number }).durationSeconds), align: 'right', width: 12 },
              ],
            },
          ]}
          csvOverride={{
            // Inline-flatten: each parent process followed by its sub-process
            // rows, distinguished by a leading "Tip reda" column. CSV can't
            // do sheets, so this is the equivalent layout.
            rowsFor: (mainRows) =>
              mainRows.flatMap((i) => {
                const fmtDate = (iso: string | null) =>
                  iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '';
                const parentRow = {
                  rowType: t('reports.rowTypeProcess'),
                  orderNumber: i.orderNumber,
                  productCategoryName: i.productCategoryName,
                  orderType: resolveOrderTypeName(i.orderType),
                  processCode: i.processCode,
                  processName: i.processName,
                  complexity: i.complexity ?? '',
                  startedAt: fmtDate(i.startedAt),
                  completedAt: fmtDate(i.completedAt),
                  duration: formatSeconds(i.durationSeconds),
                };
                const subRows = i.subProcesses.map((sp) => ({
                  rowType: t('reports.rowTypeSubProcess'),
                  orderNumber: i.orderNumber,
                  productCategoryName: '',
                  orderType: '',
                  processCode: i.processCode,
                  processName: `↳ ${sp.name}`,
                  complexity: '',
                  startedAt: '',
                  completedAt: '',
                  duration: formatSeconds(sp.durationSeconds),
                }));
                return [parentRow, ...subRows];
              }),
            columns: [
              { header: t('reports.rowType'), value: (r: unknown) => (r as { rowType: string }).rowType, width: 12 },
              { header: t('reports.orderNumber'), value: (r: unknown) => (r as { orderNumber: string }).orderNumber, width: 16 },
              { header: t('reports.productCategory'), value: (r: unknown) => (r as { productCategoryName: string }).productCategoryName, width: 20 },
              { header: t('reports.orderType'), value: (r: unknown) => (r as { orderType: string }).orderType, width: 14 },
              { header: t('reports.processCode'), value: (r: unknown) => (r as { processCode: string }).processCode, width: 12 },
              { header: t('reports.processName'), value: (r: unknown) => (r as { processName: string }).processName, width: 22 },
              { header: t('reports.complexity'), value: (r: unknown) => (r as { complexity: string }).complexity, width: 14 },
              { header: t('reports.startedAt'), value: (r: unknown) => (r as { startedAt: string }).startedAt, width: 18 },
              { header: t('reports.completedAt'), value: (r: unknown) => (r as { completedAt: string }).completedAt, width: 18 },
              { header: t('reports.duration'), value: (r: unknown) => (r as { duration: string }).duration, align: 'right', width: 12 },
            ],
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="orderItemProcessId"
        loading={isLoading}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        size="small"
        bordered
        rowClassName={(record) =>
          record.isExcludedFromReports ? 'report-row-excluded' : ''
        }
        scroll={{ x: 'max-content' }}
        expandable={
          hasAnyExpandable
            ? {
                rowExpandable: (record) => record.subProcesses.length > 0,
                expandedRowRender: (record) => (
                  <Table
                    columns={subProcessColumns}
                    dataSource={record.subProcesses}
                    rowKey="subProcessId"
                    pagination={false}
                    size="small"
                    style={{ margin: 0 }}
                  />
                ),
              }
            : undefined
        }
      />
    </>
  );
}
