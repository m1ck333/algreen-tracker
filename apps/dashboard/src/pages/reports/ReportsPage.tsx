import { useState, useMemo, useEffect } from 'react';
import {
  Tabs,
  Table,
  Select,
  DatePicker,
  Card,
  Space,
  Input,
  Switch,
  Empty,
  Tooltip,
  App,
  theme,
} from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import {
  reportsApi,
  processesApi,
  usersApi,
  productCategoriesApi,
  orderTypesApi,
  processWorkflowApi,
} from '@alblue/api-client';
import type {
  ProcessTimeItemDto,
  TimeTrackingItemDto,
  WorkerHoursDto,
  ProcessDto,
  UserDto,
  ProductCategoryDto,
  OrderTypeDto,
  BlocksPerProcessBucketDto,
  ProductManufacturingTimeOrderDto,
  WorkEfficiencyRowDto,
} from '@alblue/shared-types';
import { UserRole, ComplexityType } from '@alblue/shared-types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { PageHeader } from '../../components/PageHeader';
import {
  BarChart,
  Bar,
  Line,
  Area,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts';

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

// ─── Helpers ────────────────────────────────────────────

/** Format seconds as h:mm:ss. Time-tracking rows use this directly. */
function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return '0:00:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Process-times stats arrive as decimal minutes (BE divides seconds by 60). */
function formatMinutes(decimalMinutes: number | null | undefined): string {
  if (decimalMinutes == null || decimalMinutes <= 0) return '0:00:00';
  return formatSeconds(Math.round(decimalMinutes * 60));
}

const COMPLEXITY_ORDER: ComplexityType[] = [ComplexityType.T, ComplexityType.S, ComplexityType.L];

// ─── Vremena po procesu tab ──────────────────────────────

function ProcessAveragesTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(90, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);

  const { data: categories } = useQuery({
    queryKey: ['product-categories-for-reports', tenantId],
    queryFn: () =>
      productCategoriesApi.getAll({ pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // Per-tenant order types (Sale/Bojan can rename these). Filter values use
  // the immutable .code; UI labels use the configurable .name.
  const { data: orderTypeList } = useQuery({
    queryKey: ['order-types-for-reports', tenantId],
    queryFn: () =>
      orderTypesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-process-times',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      categoryIds,
      orderTypes,
    ],
    queryFn: () =>
      reportsApi
        .getProcessTimes({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          productCategoryIds: categoryIds.length ? categoryIds : undefined,
          orderTypes: orderTypes.length ? orderTypes : undefined,
        })
        .then((r) => r.data.processes),
    enabled: !!tenantId,
  });

  const complexityLabels: Record<string, string> = {
    T: t('reports.complexityT'),
    S: t('reports.complexityS'),
    L: t('reports.complexityL'),
  };

  // Column groups: 4 ID cols + 5 metric cols per complexity (Prosek, min,
  // max, Realni prosek, St. devijacija). Kategorija proizvoda + Tip
  // narudžbine columns echo the active filter value per Tab 1 spec
  // (same value on every row — it's filter context, not per-row data).
  const filterLabelAll = t('reports.filterAll');
  // Resolve OrderType code → configurable per-tenant name (Sale/Bojan can
  // rename in Admin → Order Types; reports must always show the saved name).
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
  const categoryFilterLabel = categoryIds.length === 0
    ? filterLabelAll
    : categories?.filter((c) => categoryIds.includes(c.id)).map((c) => c.name).join(', ') ?? '';
  const orderTypeFilterLabel = orderTypes.length === 0
    ? filterLabelAll
    : orderTypes.map(resolveOrderTypeName).join(', ');

  const columns: ColumnsType<ProcessTimeItemDto> = useMemo(() => {
    const cols: ColumnsType<ProcessTimeItemDto> = [
      {
        title: t('reports.processCode'),
        dataIndex: 'processCode',
        width: 60,
        fixed: 'left',
        sorter: (a, b) => a.processCode.localeCompare(b.processCode),
      },
      {
        title: t('reports.processName'),
        dataIndex: 'processName',
        width: 160,
        fixed: 'left',
      },
      {
        title: t('reports.productCategory'),
        key: 'productCategoryFilter',
        width: 160,
        render: () => categoryFilterLabel,
      },
      {
        title: t('reports.orderType'),
        key: 'orderTypeFilter',
        width: 130,
        render: () => orderTypeFilterLabel,
      },
    ];
    // Each complexity group (Teško/Srednje/Lako) gets a 2px left+right
    // border to mimic the Excel "uokvirivanje" Sale/Bojan asked for.
    // First inner column gets the bold left edge, last gets the bold right.
    const groupLeftEdge = {
      onHeaderCell: () => ({ style: { borderLeft: `2px solid ${token.colorBorder}` } }),
      onCell: () => ({ style: { borderLeft: `2px solid ${token.colorBorder}` } }),
    };
    const groupRightEdge = {
      onHeaderCell: () => ({ style: { borderRight: `2px solid ${token.colorBorder}` } }),
      onCell: () => ({ style: { borderRight: `2px solid ${token.colorBorder}` } }),
    };
    for (const c of COMPLEXITY_ORDER) {
      cols.push({
        title: complexityLabels[c],
        // Bold border on the group's header cell too (the merged title row).
        onHeaderCell: () => ({
          style: {
            borderLeft: `2px solid ${token.colorBorder}`,
            borderRight: `2px solid ${token.colorBorder}`,
            fontWeight: 600,
          },
        }),
        children: [
          {
            title: t('reports.avg'),
            key: `avg-${c}`,
            width: 90,
            align: 'right',
            ...groupLeftEdge,
            render: (_: unknown, record: ProcessTimeItemDto) => {
              const v = record.stats[c]?.avgMinutes;
              return v != null ? formatMinutes(v) : '—';
            },
          },
          {
            title: t('reports.min'),
            key: `min-${c}`,
            width: 90,
            align: 'right',
            render: (_: unknown, record: ProcessTimeItemDto) => {
              const v = record.stats[c]?.minMinutes;
              return v != null ? formatMinutes(v) : '—';
            },
          },
          {
            title: t('reports.max'),
            key: `max-${c}`,
            width: 90,
            align: 'right',
            render: (_: unknown, record: ProcessTimeItemDto) => {
              const v = record.stats[c]?.maxMinutes;
              return v != null ? formatMinutes(v) : '—';
            },
          },
          {
            title: t('reports.trimmedAvg'),
            key: `trimmed-${c}`,
            width: 100,
            align: 'right',
            render: (_: unknown, record: ProcessTimeItemDto) => {
              const v = record.stats[c]?.trimmedMeanMinutes;
              return v != null ? formatMinutes(v) : '—';
            },
          },
          {
            title: t('reports.stdDev'),
            key: `stdev-${c}`,
            width: 100,
            align: 'right',
            ...groupRightEdge,
            render: (_: unknown, record: ProcessTimeItemDto) => {
              const v = record.stats[c]?.stdevMinutes;
              return v != null ? formatMinutes(v) : '—';
            },
          },
        ],
      });
    }
    return cols;
  }, [t, categoryFilterLabel, orderTypeFilterLabel, token]);

  // Chart "Prosečno vreme po procesu" — one grouped bar per process showing
  // Realni prosek (trimmed mean) per complexity. Sale/Bojan feedback
  // 22.05.2026 wanted the trimmed value here, not plain Prosek, because
  // it filters outliers (e.g., abandoned-process 48h sessions) the same
  // way the Realni prosek column does. Excel colors: T=blue, S=green,
  // L=orange. Values are in minutes (BE-side unit).
  const chartData = useMemo(() => {
    if (!data) return [];
    return data
      .filter((p) =>
        COMPLEXITY_ORDER.some((c) => (p.stats[c]?.count ?? 0) > 0),
      )
      .map((p) => ({
        process: p.processCode,
        name: p.processName,
        // Stable data keys (T/S/L). The legend uses Bar `name` prop with the
        // localized label so switching dashboard locale also flips the
        // chart legend without rebuilding this data array.
        T: Number((p.stats[ComplexityType.T]?.trimmedMeanMinutes ?? 0).toFixed(2)),
        S: Number((p.stats[ComplexityType.S]?.trimmedMeanMinutes ?? 0).toFixed(2)),
        L: Number((p.stats[ComplexityType.L]?.trimmedMeanMinutes ?? 0).toFixed(2)),
      }));
  }, [data]);

  const exportColumns: ExportColumn<ProcessTimeItemDto>[] = useMemo(() => {
    const base: ExportColumn<ProcessTimeItemDto>[] = [
      { header: t('reports.processCode'), value: (p) => p.processCode, width: 14 },
      { header: t('reports.processName'), value: (p) => p.processName, width: 26 },
      { header: t('reports.productCategory'), value: () => categoryFilterLabel, width: 22 },
      { header: t('reports.orderType'), value: () => orderTypeFilterLabel, width: 18 },
    ];
    for (const c of COMPLEXITY_ORDER) {
      const label = complexityLabels[c];
      base.push(
        {
          header: `${label} — ${t('reports.avg')} (min)`,
          value: (p) => p.stats[c]?.avgMinutes ?? null,
          align: 'right',
          width: 14,
        },
        {
          header: `${label} — ${t('reports.min')} (min)`,
          value: (p) => p.stats[c]?.minMinutes ?? null,
          align: 'right',
          width: 14,
        },
        {
          header: `${label} — ${t('reports.max')} (min)`,
          value: (p) => p.stats[c]?.maxMinutes ?? null,
          align: 'right',
          width: 14,
        },
        {
          header: `${label} — ${t('reports.trimmedAvg')} (min)`,
          value: (p) => p.stats[c]?.trimmedMeanMinutes ?? null,
          align: 'right',
          width: 16,
        },
        {
          header: `${label} — ${t('reports.stdDev')} (min)`,
          value: (p) => p.stats[c]?.stdevMinutes ?? null,
          align: 'right',
          width: 14,
        },
        {
          header: `${label} — ${t('reports.count')}`,
          value: (p) => p.stats[c]?.count ?? 0,
          align: 'right',
          width: 12,
        },
      );
    }
    return base;
  }, [t, categoryFilterLabel, orderTypeFilterLabel]);

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
        <Select
          mode="multiple"
          placeholder={t('reports.allCategories')}
          value={categoryIds}
          onChange={setCategoryIds}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 240 }}
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
          style={{ minWidth: 200 }}
          options={orderTypeList?.map((ot: OrderTypeDto) => ({
            label: ot.name,
            value: ot.code,
          }))}
        />
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () => data ?? []}
          columns={exportColumns}
          options={{
            fileName: `reports-process-times-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabAverages')}`,
            sheetName: t('reports.tabAverages'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
              ...(categoryIds.length
                ? [
                    {
                      label: t('reports.productCategory'),
                      value:
                        categories
                          ?.filter((c) => categoryIds.includes(c.id))
                          .map((c) => c.name)
                          .join(', ') ?? '',
                    },
                  ]
                : []),
              ...(orderTypes.length
                ? [{ label: t('reports.orderType'), value: orderTypes.map(resolveOrderTypeName).join(', ') }]
                : []),
            ],
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="processId"
        loading={isLoading}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />

      <Card size="small" style={{ marginTop: 16 }} title={t('reports.chartAvgByProcess')}>
        {chartData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="process" />
              <YAxis
                label={{ value: t('reports.minutesUnit'), angle: -90, position: 'insideLeft' }}
              />
              <RechartsTooltip
                formatter={(value) => formatMinutes(typeof value === 'number' ? value : Number(value))}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload as { process: string; name: string } | undefined;
                  return item ? `${item.process} — ${item.name}` : String(label);
                }}
                contentStyle={{
                  backgroundColor: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusLG,
                  color: token.colorText,
                }}
                labelStyle={{ color: token.colorText, fontWeight: 600 }}
                itemStyle={{ color: token.colorText }}
                cursor={{ fill: token.colorFillTertiary }}
              />
              {/* Bars are declared heaviest-first (T → S → L), so the
                  legend already reads in that order. Plain <Legend/> keeps
                  the standard icon-then-text layout used by every other
                  chart (the old rtl hack reversed it and dropped the gap). */}
              <Legend />
              {/* Colors match Sale/Bojan's Excel cover page chart. */}
              <Bar dataKey="T" name={complexityLabels.T} fill="#1890ff" maxBarSize={40} />
              <Bar dataKey="S" name={complexityLabels.S} fill="#52c41a" maxBarSize={40} />
              <Bar dataKey="L" name={complexityLabels.L} fill="#fa8c16" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <ProcessTimeTrendChart />
      <DeliveryComplianceChart />
      <ActiveProcessFunnelChart />
    </>
  );
}

// ─── Chart: Trend prosečnog vremena po nedelji ──────────
//
// Per Sale/Bojan feedback 29.05.2026: the chart shows two lines plus a
// target, NOT a min/max band (the band was flagged as wrong — they want
// the MAX value plotted, not a shaded range):
//   • Max line   = window-clamped maxMinutes per period bucket.
//   • Blue line  = Realni prosek (trimmed mean) per bucket.
//   • Red dashed = Normativ = 85% of trimmed mean across the WHOLE
//     filtered period (constant horizontal target).
// Filters: Proces (single), Kompleksnost (single), Granul (week/month).
// Chart is empty until both Proces + Kompleksnost are picked, since the
// trend has no meaning across mixed (process × complexity) populations.

function ProcessTimeTrendChart() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const [processId, setProcessId] = useState<string | undefined>(undefined);
  const [complexity, setComplexity] = useState<ComplexityType | undefined>(undefined);
  const [granularity, setGranularity] = useState<'Week' | 'Month'>('Week');
  // Period selector per Bojan 25.05.2026 — month / 3 months / 6 months / year.
  // Stored as a count of days so it round-trips cleanly through the query key.
  const [periodDays, setPeriodDays] = useState<number>(180);

  const { data: processes } = useQuery({
    queryKey: ['processes-for-reports', tenantId],
    queryFn: () => processesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  // Auto-pick the first process + S complexity on first load so the chart
  // renders immediately. Without this, the user faced a forced 2-dropdown
  // ritual before seeing anything — bad UX feedback 26.05.2026.
  useEffect(() => {
    if (!processId && processes && processes.length > 0) {
      setProcessId(processes[0].id);
    }
    if (!complexity) {
      setComplexity(ComplexityType.S);
    }
  }, [processes, processId, complexity]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-process-time-trend', tenantId, processId, complexity, granularity, periodDays],
    queryFn: () =>
      reportsApi
        .getProcessTimeTrend({
          processId: processId!,
          complexity: complexity!,
          granularity,
          from: dayjs().subtract(periodDays, 'day').format('YYYY-MM-DD'),
          to: dayjs().format('YYYY-MM-DD'),
        })
        .then((r) => r.data),
    enabled: !!tenantId && !!processId && !!complexity,
  });

  const chartData = useMemo(
    () =>
      (data?.buckets ?? []).map((b) => ({
        bucket: dayjs(b.bucketStart).format(granularity === 'Week' ? 'DD.MM' : 'MM.YYYY'),
        max: Number(b.maxMinutes.toFixed(2)),
        min: Number(b.minMinutes.toFixed(2)),
        // Range tuple [min, max] drives the colored band Area. Recharts
        // renders a tuple dataKey as a vertical band per bucket. Bojan/Sale
        // 06.06.2026: bring back the min-max range visualisation.
        range: [Number(b.minMinutes.toFixed(2)), Number(b.maxMinutes.toFixed(2))],
        avg: Number(b.trimmedMeanMinutes.toFixed(2)),
        _count: b.count,
      })),
    [data, granularity],
  );

  const normativ = data?.normativMinutes ?? null;
  const filtersReady = !!processId && !!complexity;

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={t('reports.chartWeeklyTrend')}
      loading={isLoading}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          placeholder={t('reports.allProcesses')}
          value={processId}
          onChange={setProcessId}
          style={{ width: 220 }}
          showSearch
          optionFilterProp="label"
          options={processes?.map((p: ProcessDto) => ({
            label: `${p.code} — ${p.name}`,
            value: p.id,
          }))}
        />
        <Select
          placeholder={t('reports.allComplexities')}
          value={complexity}
          onChange={setComplexity}
          style={{ width: 180 }}
          options={[
            { label: t('reports.complexityT'), value: ComplexityType.T },
            { label: t('reports.complexityS'), value: ComplexityType.S },
            { label: t('reports.complexityL'), value: ComplexityType.L },
          ]}
        />
        <Select
          value={granularity}
          onChange={setGranularity}
          style={{ width: 140 }}
          options={[
            { label: t('reports.granularityWeek'), value: 'Week' },
            { label: t('reports.granularityMonth'), value: 'Month' },
          ]}
        />
        <Select
          value={periodDays}
          onChange={setPeriodDays}
          style={{ width: 160 }}
          options={[
            { label: t('reports.period1Month'), value: 30 },
            { label: t('reports.period3Months'), value: 90 },
            { label: t('reports.period6Months'), value: 180 },
            { label: t('reports.period1Year'), value: 365 },
          ]}
        />
      </Space>
      {!filtersReady ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('reports.trendPickFilters')}
        />
      ) : chartData.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" padding={{ left: 16, right: 16 }} />
            <YAxis
              label={{ value: t('reports.minutesUnit'), angle: -90, position: 'insideLeft' }}
            />
            <RechartsTooltip
              formatter={(value, name) => {
                // The range Area dataKey is a tuple [min, max]; render that
                // as a single "min–max" string in the tooltip to make the
                // band's bounds explicit. Other lines stay numeric.
                if (name === 'range' && Array.isArray(value)) {
                  const lo = formatMinutes(Number(value[0]));
                  const hi = formatMinutes(Number(value[1]));
                  return [`${lo} – ${hi}`, `${t('reports.min')} – ${t('reports.max')}`];
                }
                const minutes = formatMinutes(typeof value === 'number' ? value : Number(value));
                if (name === 'max') return [minutes, t('reports.max')];
                if (name === 'min') return [minutes, t('reports.min')];
                if (name === 'avg') return [minutes, t('reports.trimmedAvg')];
                return [minutes, String(name)];
              }}
              contentStyle={{
                backgroundColor: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                color: token.colorText,
              }}
              labelStyle={{ color: token.colorText, fontWeight: 600 }}
              itemStyle={{ color: token.colorText }}
              cursor={{ stroke: token.colorBorderSecondary }}
            />
            <Legend
              formatter={(v) =>
                v === 'avg'
                  ? t('reports.trimmedAvg')
                  : v === 'max'
                  ? t('reports.max')
                  : v === 'min'
                  ? t('reports.min')
                  : v === 'range'
                  ? `${t('reports.min')} – ${t('reports.max')}`
                  : v === 'normativ'
                  ? t('reports.normativ')
                  : v
              }
            />
            {/* Min-Max colored band (Bojan/Sale 06.06.2026 — back to showing
                the range visually). The `range` tuple drives a vertical band
                between min and max per bucket. */}
            <Area
              type="monotone"
              dataKey="range"
              name="range"
              stroke="none"
              fill={token.colorSuccessBg}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            {/* Max line. */}
            <Line
              type="monotone"
              dataKey="max"
              name="max"
              stroke={token.colorWarning}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            {/* Min line — Bojan/Sale 06.06.2026 wanted min back. */}
            <Line
              type="monotone"
              dataKey="min"
              name="min"
              stroke={token.colorSuccess}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            {/* Realni prosek (trimmed mean). */}
            <Line
              type="monotone"
              dataKey="avg"
              name="avg"
              stroke={token.colorPrimary}
              strokeWidth={2}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
            {normativ != null && (
              <ReferenceLine
                y={normativ}
                stroke={token.colorError}
                strokeDasharray="5 5"
                label={{
                  value: `${t('reports.normativ')}: ${formatMinutes(normativ)}`,
                  fill: token.colorText,
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Chart: Analiza kašnjenja i poštovanja rokova ──────
//
// 100% stacked bar per period bucket (week/month): green = % completed
// on time (CompletedAt ≤ DeliveryDate, day-precision), red = % completed
// late. Per-tenant order-type filter. Sale/Bojan spec 22.05.2026.

function DeliveryComplianceChart() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const [granularity, setGranularity] = useState<'Week' | 'Month'>('Week');
  const [orderTypes, setOrderTypes] = useState<string[]>([]);

  const { data: orderTypeList } = useQuery({
    queryKey: ['order-types-for-reports', tenantId],
    queryFn: () =>
      orderTypesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports-delivery-compliance', tenantId, granularity, orderTypes],
    queryFn: () =>
      reportsApi
        .getDeliveryCompliance({
          from: dayjs().subtract(180, 'day').format('YYYY-MM-DD'),
          to: dayjs().format('YYYY-MM-DD'),
          granularity,
          orderTypes: orderTypes.length ? orderTypes : undefined,
        })
        .then((r) => r.data.buckets),
    enabled: !!tenantId,
  });

  const chartData = useMemo(
    () =>
      (data ?? []).map((b) => ({
        bucket: dayjs(b.bucketStart).format(granularity === 'Week' ? 'DD.MM' : 'MM.YYYY'),
        OnTime: b.onTimePercent,
        Late: b.latePercent,
        // Raw counts surface in tooltip for context.
        _onTimeCount: b.onTimeCount,
        _lateCount: b.lateCount,
        _total: b.totalCount,
      })),
    [data, granularity],
  );

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={t('reports.chartDeliveryCompliance')}
      loading={isLoading}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          value={granularity}
          onChange={(v) => setGranularity(v)}
          style={{ width: 140 }}
          options={[
            { label: t('reports.granularityWeek'), value: 'Week' },
            { label: t('reports.granularityMonth'), value: 'Month' },
          ]}
        />
        <Select
          mode="multiple"
          placeholder={t('reports.allTypes')}
          value={orderTypes}
          onChange={setOrderTypes}
          allowClear
          style={{ minWidth: 200 }}
          options={orderTypeList?.map((ot) => ({ label: ot.name, value: ot.code }))}
        />
      </Space>
      {chartData.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis domain={[0, 100]} unit="%" />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                color: token.colorText,
              }}
              labelStyle={{ color: token.colorText, fontWeight: 600 }}
              itemStyle={{ color: token.colorText }}
              cursor={{ fill: token.colorFillTertiary }}
              formatter={(value, name, item) => {
                const payload = item?.payload as
                  | { _onTimeCount: number; _lateCount: number; _total: number }
                  | undefined;
                if (!payload) return [`${value}%`, name];
                const count = name === 'OnTime' ? payload._onTimeCount : payload._lateCount;
                return [`${value}% (${count}/${payload._total})`, name];
              }}
            />
            <Legend
              formatter={(v) => (v === 'OnTime' ? t('reports.onTime') : t('reports.late'))}
            />
            {/* maxBarSize caps width so two-bucket views don't look like
                wallpaper. Recharts otherwise stretches bars to fill the
                available width per category. */}
            <Bar dataKey="OnTime" stackId="compliance" fill="#52c41a" maxBarSize={60} />
            <Bar dataKey="Late" stackId="compliance" fill="#ff4d4f" maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Chart: Napredak aktivnih narudžbina (funnel po fazama) ──
//
// Horizontal bar per process, with three stacked segments:
//   • U toku (blue)            — InProgress
//   • Spreman za izvršavanje (gray) — Pending + all deps complete
//   • Blokirano (red)          — Blocked
// Sale/Bojan clarified 23.05.2026: the gray "Na čekanju" label in the
// mock was wrong; the gray boldirani kvadratić in live order tracking
// represents "spreman za izvršavanje", and that's what the gray here is.
// Pending-but-waiting-on-deps rows are excluded — the chart only shows
// rows that are actively in the pipeline for that process.

function ActiveProcessFunnelChart() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<ComplexityType | undefined>(undefined);

  const { data: orderTypeList } = useQuery({
    queryKey: ['order-types-for-reports', tenantId],
    queryFn: () =>
      orderTypesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports-active-funnel', tenantId, orderTypes, complexity],
    queryFn: () =>
      reportsApi
        .getActiveProcessFunnel({
          orderTypes: orderTypes.length ? orderTypes : undefined,
          complexity,
        })
        .then((r) => r.data.processes),
    enabled: !!tenantId,
  });

  // Map to chart-friendly rows. Each process is one row; segments stack.
  const chartData = useMemo(
    () =>
      (data ?? []).map((p) => ({
        process: p.processCode,
        processName: p.processName,
        InProgress: p.inProgressCount,
        Ready: p.readyCount,
        Blocked: p.blockedCount,
      })),
    [data],
  );

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title={t('reports.chartActiveFunnel')}
      loading={isLoading}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          mode="multiple"
          placeholder={t('reports.allTypes')}
          value={orderTypes}
          onChange={setOrderTypes}
          allowClear
          style={{ minWidth: 200 }}
          options={orderTypeList?.map((ot) => ({ label: ot.name, value: ot.code }))}
        />
        <Select
          placeholder={t('reports.allComplexities')}
          value={complexity}
          onChange={setComplexity}
          allowClear
          style={{ width: 180 }}
          options={[
            { label: t('reports.complexityT'), value: ComplexityType.T },
            { label: t('reports.complexityS'), value: ComplexityType.S },
            { label: t('reports.complexityL'), value: ComplexityType.L },
          ]}
        />
      </Space>
      {chartData.every((d) => d.InProgress + d.Ready + d.Blocked === 0) ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36 + 80)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="process" width={36} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                color: token.colorText,
              }}
              labelStyle={{ color: token.colorText, fontWeight: 600 }}
              itemStyle={{ color: token.colorText }}
              cursor={{ fill: token.colorFillTertiary }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as
                  | { process: string; processName: string }
                  | undefined;
                return row ? `${row.process} — ${row.processName}` : String(label);
              }}
              formatter={(value, name) => [
                value,
                name === 'InProgress'
                  ? t('reports.funnelInProgress')
                  : name === 'Ready'
                  ? t('reports.funnelReady')
                  : name === 'Blocked'
                  ? t('reports.funnelBlocked')
                  : String(name),
              ]}
            />
            <Legend
              formatter={(v) =>
                v === 'InProgress'
                  ? t('reports.funnelInProgress')
                  : v === 'Ready'
                  ? t('reports.funnelReady')
                  : v === 'Blocked'
                  ? t('reports.funnelBlocked')
                  : v
              }
            />
            <Bar dataKey="InProgress" stackId="funnel" fill="#1890ff" maxBarSize={28} />
            <Bar dataKey="Ready" stackId="funnel" fill="#8c8c8c" maxBarSize={28} />
            <Bar dataKey="Blocked" stackId="funnel" fill="#ff4d4f" maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Praćenje vremena tab ─────────────────────────────────

function TimeTrackingTab() {
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
          style={{ width: 220 }}
        />
        <Select
          placeholder={t('reports.allProcesses')}
          value={processId}
          onChange={setProcessId}
          allowClear
          style={{ width: 180 }}
          options={processes?.map((p: ProcessDto) => ({ label: `${p.code} — ${p.name}`, value: p.id }))}
        />
        <Select
          placeholder={t('reports.allComplexities')}
          value={complexity}
          onChange={setComplexity}
          allowClear
          style={{ width: 160 }}
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

// ─── Worker Hours Tab (unchanged scope, kept) ─────────────

function WorkerHoursTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ['users-for-reports', tenantId],
    queryFn: () =>
      usersApi
        .getAll({ role: UserRole.Department, page: 1, pageSize: 100 })
        .then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-worker-hours',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      userId,
    ],
    queryFn: () =>
      reportsApi
        .getWorkerHours({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          userId,
        })
        .then((r) => r.data.workers),
    enabled: !!tenantId,
  });

  // Worker session durations ARE in real minutes (sessions track wall-clock
  // minutes). Different unit from process times — keep the legacy formatter
  // local to this tab.
  const formatMinutesAsHM = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return '0h 00m';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const effCell = (v: number) => {
    const color = v >= 80 ? token.colorSuccess : v >= 60 ? token.colorWarning : token.colorError;
    return <span style={{ color, fontWeight: 600 }}>{v.toFixed(0)}%</span>;
  };

  // Per-worker totals row (the "Zbir" the Excel puts at the bottom of each
  // worker's daily block). Daily detail is on the expand. Sale/Bojan 29.05.2026.
  const columns: ColumnsType<WorkerHoursDto> = useMemo(
    () => [
      { title: t('reports.workerName'), dataIndex: 'fullName', fixed: 'left', width: 180 },
      { title: t('reports.regularHours'), dataIndex: 'regularMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.overtimeHours'), dataIndex: 'overtimeMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      {
        title: t('reports.totalHours'),
        dataIndex: 'totalWorkedMinutes',
        align: 'right',
        sorter: (a, b) => a.totalWorkedMinutes - b.totalWorkedMinutes,
        defaultSortOrder: 'descend',
        render: (v: number) => formatMinutesAsHM(v),
      },
      { title: t('reports.effectiveHours'), dataIndex: 'effectiveMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.activeHours'), dataIndex: 'activeMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.uncoveredHours'), dataIndex: 'uncoveredMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      {
        title: t('reports.efficiencyPercent'),
        dataIndex: 'efficiencyPercent',
        align: 'right',
        sorter: (a, b) => a.efficiencyPercent - b.efficiencyPercent,
        render: (v: number) => effCell(v),
      },
    ],
    [t, token],
  );

  const dailyColumns: ColumnsType<WorkerHoursDto['dailyBreakdown'][0]> = useMemo(
    () => [
      { title: t('reports.date'), dataIndex: 'date', render: (v: string) => dayjs(v).format('DD.MM.YYYY') },
      { title: t('reports.checkIn'), dataIndex: 'firstCheckIn', render: (v: string | null) => (v ? dayjs(v).format('HH:mm') : '—') },
      { title: t('reports.checkOut'), dataIndex: 'lastCheckOut', render: (v: string | null) => (v ? dayjs(v).format('HH:mm') : '—') },
      { title: t('reports.regularHours'), dataIndex: 'regularMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.overtimeHours'), dataIndex: 'overtimeMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.totalHours'), dataIndex: 'totalWorkedMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.effectiveHours'), dataIndex: 'effectiveMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.activeHours'), dataIndex: 'activeMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.uncoveredHours'), dataIndex: 'uncoveredMinutes', align: 'right', render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.efficiencyPercent'), dataIndex: 'efficiencyPercent', align: 'right', render: (v: number) => effCell(v) },
      {
        title: t('reports.autoLogoutApplied'),
        dataIndex: 'autoLogoutApplied',
        align: 'center',
        render: (v: boolean) => (v ? <span style={{ color: token.colorWarning }}>{t('reports.autoLogoutAppliedYes')}</span> : t('reports.autoLogoutAppliedNo')),
      },
    ],
    [t, token],
  );

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
        <Select
          placeholder={t('reports.allWorkers')}
          value={userId}
          onChange={setUserId}
          allowClear
          style={{ width: 220 }}
          showSearch
          optionFilterProp="label"
          options={users?.map((u: UserDto) => ({
            label: `${u.firstName} ${u.lastName}`,
            value: u.id,
          }))}
        />
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () =>
            // Per worker: the daily rows, then a per-worker UKUPNO (Zbir) row,
            // matching the on-screen worker totals + Excel Table 1.
            (data ?? []).flatMap((w) => [
              ...w.dailyBreakdown.map((d) => ({ worker: w.fullName, ...d })),
              {
                worker: w.fullName,
                date: '',
                firstCheckIn: null,
                lastCheckOut: null,
                regularMinutes: w.regularMinutes,
                overtimeMinutes: w.overtimeMinutes,
                totalWorkedMinutes: w.totalWorkedMinutes,
                effectiveMinutes: w.effectiveMinutes,
                activeMinutes: w.activeMinutes,
                uncoveredMinutes: w.uncoveredMinutes,
                efficiencyPercent: w.efficiencyPercent,
                sessionCount: 0,
                autoLogoutApplied: false,
              },
            ])
          }
          columns={[
            { header: t('reports.workerName'), value: (r) => r.worker, width: 22 },
            { header: t('reports.date'), value: (r) => (r.date ? dayjs(r.date).format('DD.MM.YYYY.') : t('reports.blocksTotalRow')), width: 12 },
            { header: t('reports.checkIn'), value: (r) => (r.firstCheckIn ? dayjs(r.firstCheckIn).format('HH:mm') : ''), align: 'center', width: 10 },
            { header: t('reports.checkOut'), value: (r) => (r.lastCheckOut ? dayjs(r.lastCheckOut).format('HH:mm') : ''), align: 'center', width: 10 },
            { header: `${t('reports.regularHours')} (min)`, value: (r) => r.regularMinutes, align: 'right', width: 12 },
            { header: `${t('reports.overtimeHours')} (min)`, value: (r) => r.overtimeMinutes, align: 'right', width: 12 },
            { header: `${t('reports.totalHours')} (min)`, value: (r) => r.totalWorkedMinutes, align: 'right', width: 12 },
            { header: `${t('reports.effectiveHours')} (min)`, value: (r) => r.effectiveMinutes, align: 'right', width: 12 },
            { header: `${t('reports.activeHours')} (min)`, value: (r) => r.activeMinutes, align: 'right', width: 14 },
            { header: `${t('reports.uncoveredHours')} (min)`, value: (r) => r.uncoveredMinutes, align: 'right', width: 12 },
            { header: t('reports.efficiencyPercent'), value: (r) => r.efficiencyPercent, align: 'right', width: 12 },
            { header: t('reports.autoLogoutApplied'), value: (r) => (r.date ? (r.autoLogoutApplied ? t('reports.autoLogoutAppliedYes') : t('reports.autoLogoutAppliedNo')) : ''), align: 'center', width: 12 },
          ]}
          options={{
            fileName: `reports-worker-hours-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabWorkerHours')}`,
            sheetName: t('reports.tabWorkerHours'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
              ...(userId ? [{ label: t('reports.workerName'), value: users?.find((u) => u.id === userId)?.fullName ?? userId }] : []),
            ],
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="userId"
        loading={isLoading}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        size="small"
        bordered
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
          expandedRowRender: (record) => (
            <Table
              columns={dailyColumns}
              dataSource={record.dailyBreakdown}
              rowKey="date"
              pagination={false}
              size="small"
              style={{ margin: 0 }}
            />
          ),
        }}
      />
    </>
  );
}

// ─── Blokade po procesu tab ──────────────────────────────
// Per-process aggregate of block requests. BE computes average duration
// in WORKING HOURS only (intersection with active Shift windows) per
// Bojan spec 25.05.2026 — overnight/weekend gaps don't inflate averages.
// Approved = Approved + Resolved; Rejected counts toward "submitted"
// but contributes zero duration. Two charts: avg duration (h) on the
// left, submitted vs approved on the right.

function BlocksPerProcessTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-blocks-per-process',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      reportsApi
        .getBlocksPerProcess({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
        })
        .then((r) => r.data.processes),
    enabled: !!tenantId,
  });

  const rows = useMemo<BlocksPerProcessBucketDto[]>(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    [data],
  );

  const columns: ColumnsType<BlocksPerProcessBucketDto> = useMemo(
    () => [
      { title: t('reports.processCode'), dataIndex: 'processCode', width: 80 },
      { title: t('reports.processName'), dataIndex: 'processName' },
      {
        title: t('reports.blocksSubmitted'),
        dataIndex: 'totalSubmitted',
        align: 'right',
        sorter: (a, b) => a.totalSubmitted - b.totalSubmitted,
      },
      {
        // "Odobreno" alone = Approved-only count = (Approved+Resolved) − Resolved.
        title: t('reports.blocksApproved'),
        key: 'approvedAlone',
        align: 'right',
        sorter: (a, b) =>
          a.approvedCount - a.resolvedCount - (b.approvedCount - b.resolvedCount),
        render: (_: unknown, r: BlocksPerProcessBucketDto) => r.approvedCount - r.resolvedCount,
      },
      {
        title: t('reports.blocksResolved'),
        dataIndex: 'resolvedCount',
        align: 'right',
        sorter: (a, b) => a.resolvedCount - b.resolvedCount,
      },
      {
        title: t('reports.blocksRejected'),
        dataIndex: 'rejectedCount',
        align: 'right',
        sorter: (a, b) => a.rejectedCount - b.rejectedCount,
      },
      {
        // "Opravdane (Odob.+Rešeno)" = the justified total = ApprovedCount.
        title: t('reports.blocksJustified'),
        dataIndex: 'approvedCount',
        align: 'right',
        sorter: (a, b) => a.approvedCount - b.approvedCount,
      },
      {
        title: t('reports.blocksAvgDurationHours'),
        dataIndex: 'averageDurationHours',
        align: 'right',
        sorter: (a, b) => a.averageDurationHours - b.averageDurationHours,
        render: (v: number) => (v > 0 ? v.toFixed(2) : '—'),
      },
    ],
    [t],
  );

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        process: r.processCode,
        processName: r.processName,
        avgHours: Number(r.averageDurationHours.toFixed(2)),
        submitted: r.totalSubmitted,
        approved: r.approvedCount,
        rejected: r.rejectedCount,
      })),
    [rows],
  );

  const allZero = chartData.every((d) => d.submitted === 0 && d.avgHours === 0);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: token.colorBgElevated,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
      color: token.colorText,
    },
    labelStyle: { color: token.colorText, fontWeight: 600 as const },
    itemStyle: { color: token.colorText },
    cursor: { fill: token.colorFillTertiary },
  };

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
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () => {
            // Append the UKUPNO totals row so the export matches the on-screen table.
            const avgs = rows.map((r) => r.averageDurationHours).filter((v) => v > 0);
            const totalsRow: BlocksPerProcessBucketDto = {
              processId: 'totals',
              processCode: '',
              processName: t('reports.blocksTotalRow'),
              sequenceOrder: Number.MAX_SAFE_INTEGER,
              totalSubmitted: rows.reduce((a, r) => a + r.totalSubmitted, 0),
              approvedCount: rows.reduce((a, r) => a + r.approvedCount, 0),
              resolvedCount: rows.reduce((a, r) => a + r.resolvedCount, 0),
              rejectedCount: rows.reduce((a, r) => a + r.rejectedCount, 0),
              averageDurationHours: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0,
            };
            return [...rows, totalsRow];
          }}
          columns={[
            { header: t('reports.processCode'), value: (r: BlocksPerProcessBucketDto) => r.processCode, width: 12 },
            { header: t('reports.processName'), value: (r: BlocksPerProcessBucketDto) => r.processName, width: 24 },
            { header: t('reports.blocksSubmitted'), value: (r: BlocksPerProcessBucketDto) => r.totalSubmitted, align: 'right', width: 14 },
            { header: t('reports.blocksApproved'), value: (r: BlocksPerProcessBucketDto) => r.approvedCount - r.resolvedCount, align: 'right', width: 14 },
            { header: t('reports.blocksResolved'), value: (r: BlocksPerProcessBucketDto) => r.resolvedCount, align: 'right', width: 14 },
            { header: t('reports.blocksRejected'), value: (r: BlocksPerProcessBucketDto) => r.rejectedCount, align: 'right', width: 14 },
            { header: t('reports.blocksJustified'), value: (r: BlocksPerProcessBucketDto) => r.approvedCount, align: 'right', width: 18 },
            { header: t('reports.blocksAvgDurationHours'), value: (r: BlocksPerProcessBucketDto) => Number(r.averageDurationHours.toFixed(2)), align: 'right', width: 18 },
          ] satisfies ExportColumn<BlocksPerProcessBucketDto>[]}
          options={{
            fileName: `reports-blocks-per-process-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabBlocksPerProcess')}`,
            sheetName: t('reports.tabBlocksPerProcess'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
            ],
          }}
        />
      </div>

      <Card size="small" title={t('reports.blocksTableTitle')} style={{ marginBottom: 16 }}>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="processId"
          loading={isLoading}
          pagination={false}
          size="small"
          bordered
          summary={(pageData) => {
            const sum = (sel: (r: BlocksPerProcessBucketDto) => number) =>
              pageData.reduce((acc, r) => acc + sel(r), 0);
            const avgList = pageData.map((r) => r.averageDurationHours).filter((v) => v > 0);
            const avg = avgList.length ? avgList.reduce((a, b) => a + b, 0) / avgList.length : 0;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <strong>{t('reports.blocksTotalRow')}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}> </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">{sum((r) => r.totalSubmitted)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{sum((r) => r.approvedCount - r.resolvedCount)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{sum((r) => r.resolvedCount)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{sum((r) => r.rejectedCount)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">{sum((r) => r.approvedCount)}</Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">{avg > 0 ? avg.toFixed(2) : '—'}</Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card size="small" title={t('reports.blocksChart1Title')}>
          {allZero ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {/* Grafikon 1 — dual-axis: justified-block COUNT (left) +
                  average duration h (right) per process. */}
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="process" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" allowDecimals tickFormatter={(v: number) => `${v}h`} />
                <RechartsTooltip
                  {...tooltipStyle}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { process: string; processName: string } | undefined;
                    return row ? `${row.process} — ${row.processName}` : String(label);
                  }}
                  formatter={(value, name) =>
                    name === 'avgHours'
                      ? [`${Number(value).toFixed(2)} h`, t('reports.blocksAvgDurationHours')]
                      : [value, t('reports.blocksJustified')]
                  }
                />
                <Legend
                  formatter={(v) =>
                    v === 'avgHours' ? t('reports.blocksAvgDurationHours') : t('reports.blocksJustified')
                  }
                />
                <Bar yAxisId="left" dataKey="approved" name="approved" fill={token.colorPrimary} maxBarSize={28} />
                <Bar yAxisId="right" dataKey="avgHours" name="avgHours" fill={token.colorWarning} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card size="small" title={t('reports.blocksChart2Title')}>
          {allZero ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.noData')} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {/* Grafikon 2 — Poslato vs Opravdane vs Odbijeno per process. */}
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="process" />
                <YAxis allowDecimals={false} />
                <RechartsTooltip
                  {...tooltipStyle}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { process: string; processName: string } | undefined;
                    return row ? `${row.process} — ${row.processName}` : String(label);
                  }}
                  formatter={(value, name) => [
                    value,
                    name === 'submitted'
                      ? t('reports.blocksSubmitted')
                      : name === 'approved'
                      ? t('reports.blocksJustified')
                      : t('reports.blocksRejected'),
                  ]}
                />
                <Legend
                  formatter={(v) =>
                    v === 'submitted'
                      ? t('reports.blocksSubmitted')
                      : v === 'approved'
                      ? t('reports.blocksJustified')
                      : t('reports.blocksRejected')
                  }
                />
                <Bar dataKey="submitted" fill={token.colorPrimary} maxBarSize={24} />
                <Bar dataKey="approved" fill={token.colorSuccess} maxBarSize={24} />
                <Bar dataKey="rejected" fill={token.colorError} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </>
  );
}

// ─── Trajanje izrade proizvoda tab ───────────────────────────
// Wide per-order table. Each order's processes are columns rendered
// dynamically — Bojan spec 25.05.2026 says "Svi procesi moraju da budu
// prikazani" (no 7-process cap). For each pair of consecutive processes
// we also render the gap; overlaps are clipped (BE returns 0 for those).

function ProductManufacturingTimeTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [productCategoryIds, setProductCategoryIds] = useState<string[]>([]);

  const { data: orderTypeList } = useQuery({
    queryKey: ['order-types-for-reports', tenantId],
    queryFn: () =>
      orderTypesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: productCategoryList } = useQuery({
    queryKey: ['product-categories-for-reports', tenantId],
    queryFn: () =>
      productCategoriesApi.getAll({ isActive: true, pageSize: 200 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-product-manufacturing-time',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      orderTypes,
      productCategoryIds,
    ],
    queryFn: () =>
      reportsApi
        .getProductManufacturingTime({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          orderTypes: orderTypes.length ? orderTypes : undefined,
          productCategoryIds: productCategoryIds.length ? productCategoryIds : undefined,
        })
        .then((r) => r.data.orders),
    enabled: !!tenantId,
  });

  const rows = useMemo<ProductManufacturingTimeOrderDto[]>(() => data ?? [], [data]);

  // Težina (T/S/L) filter — narrows by each row's "najzastupljenija težina"
  // (Excel J24 filter). Drives the detail table, export and the aggregate.
  const [tezina, setTezina] = useState<string | undefined>(undefined);
  const filteredRows = useMemo(
    () => (tezina ? rows.filter((r) => r.topComplexity === tezina) : rows),
    [rows, tezina],
  );

  // Union of processes across the visible (filtered) rows, ordered by the
  // canonical process sequence (so columns always read in workflow order,
  // not first-seen order which can mis-order across mixed result sets).
  const processColumns = useMemo(() => {
    const seen = new Map<
      string,
      { processId: string; processCode: string; processName: string; sequenceOrder: number }
    >();
    filteredRows.forEach((order) => {
      order.processes.forEach((p) => {
        if (!seen.has(p.processId)) {
          seen.set(p.processId, {
            processId: p.processId,
            processCode: p.processCode,
            processName: p.processName,
            sequenceOrder: p.sequenceOrder,
          });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [filteredRows]);

  const orderTypeNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    orderTypeList?.forEach((ot: OrderTypeDto) => map.set(ot.code.toLowerCase(), ot.name));
    return map;
  }, [orderTypeList]);

  const columns: ColumnsType<ProductManufacturingTimeOrderDto> = useMemo(() => {
    const base: ColumnsType<ProductManufacturingTimeOrderDto> = [
      {
        title: t('reports.orderNumber'),
        dataIndex: 'orderNumber',
        fixed: 'left',
        width: 140,
      },
      {
        title: t('reports.orderType'),
        dataIndex: 'orderType',
        fixed: 'left',
        width: 120,
        render: (code: string) => orderTypeNameByCode.get(code.toLowerCase()) ?? code,
      },
      {
        title: t('reports.productCategory'),
        dataIndex: 'productCategoryName',
        fixed: 'left',
        width: 160,
      },
      {
        title: t('reports.manufacturingTopComplexity'),
        dataIndex: 'topComplexity',
        fixed: 'left',
        width: 90,
        align: 'center',
        render: (v: string | null) => v ?? t('reports.manufacturingNoComplexity'),
      },
      {
        title: t('reports.manufacturingComplexityShare'),
        dataIndex: 'complexityShare',
        fixed: 'left',
        width: 130,
        align: 'center',
        render: (v: string | null) => v ?? '—',
      },
    ];

    // Grouped "super" columns per process (Excel: "Proces 1/2/…" spanning the
    // sub-columns). Parent = process code+name; children = Trajanje (+ Do
    // sledećeg procesa, except for the last process).
    const dynamic: ColumnsType<ProductManufacturingTimeOrderDto> = processColumns.map((pc, idx) => {
      const children: ColumnsType<ProductManufacturingTimeOrderDto> = [
        {
          title: t('reports.manufacturingProcessDuration'),
          key: `proc-${pc.processId}-dur`,
          width: 120,
          align: 'right' as const,
          render: (_: unknown, record: ProductManufacturingTimeOrderDto) => {
            const proc = record.processes.find((p) => p.processId === pc.processId);
            return proc ? formatSeconds(proc.durationSeconds) : '—';
          },
        },
      ];
      if (idx < processColumns.length - 1) {
        children.push({
          title: t('reports.manufacturingGapToNext'),
          key: `proc-${pc.processId}-gap`,
          width: 130,
          align: 'right' as const,
          render: (_: unknown, record: ProductManufacturingTimeOrderDto) => {
            const proc = record.processes.find((p) => p.processId === pc.processId);
            return proc ? formatSeconds(proc.gapToNextSeconds) : '—';
          },
        });
      }
      return { title: `${pc.processCode} — ${pc.processName}`, children };
    });

    // Per-row Total columns intentionally omitted — the Excel keeps Total
    // only in the aggregate "Prosek" table below (Sale/Bojan 29.05.2026).
    return [...base, ...dynamic];
  }, [processColumns, orderTypeNameByCode, t]);

  // Aggregate "Prosek" table (Excel R26-28): average each process column's
  // duration + gap-to-next across the filtered rows that include it. Two rows:
  // "sa vremenom između procesa" (durations + gaps) and "bez" (durations only).
  type AggRow = {
    key: 'with' | 'without';
    label: string;
    dur: Record<string, number>;
    gap: Record<string, number | null>;
    total: number;
  };

  const aggregateRows = useMemo<AggRow[]>(() => {
    if (filteredRows.length === 0) return [];
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const dur: Record<string, number> = {};
    const gapWith: Record<string, number | null> = {};
    const gapWithout: Record<string, number | null> = {};
    let totalWith = 0;
    let totalWithout = 0;
    processColumns.forEach((pc, idx) => {
      const durs: number[] = [];
      const gaps: number[] = [];
      filteredRows.forEach((r) => {
        const p = r.processes.find((x) => x.processId === pc.processId);
        if (p) {
          durs.push(p.durationSeconds);
          gaps.push(p.gapToNextSeconds);
        }
      });
      const avgDur = Math.round(avg(durs));
      const avgGap = idx < processColumns.length - 1 ? Math.round(avg(gaps)) : 0;
      dur[pc.processId] = avgDur;
      gapWith[pc.processId] = idx < processColumns.length - 1 ? avgGap : null;
      gapWithout[pc.processId] = null;
      totalWith += avgDur + avgGap;
      totalWithout += avgDur;
    });
    return [
      { key: 'with', label: t('reports.manufacturingAvgWithGaps'), dur, gap: gapWith, total: totalWith },
      { key: 'without', label: t('reports.manufacturingAvgWithoutGaps'), dur, gap: gapWithout, total: totalWithout },
    ];
  }, [filteredRows, processColumns, t]);

  const aggregateColumns: ColumnsType<AggRow> = useMemo(() => {
    const cols: ColumnsType<AggRow> = [
      { title: t('reports.manufacturingAggregateTitle'), dataIndex: 'label', fixed: 'left', width: 280 },
    ];
    processColumns.forEach((pc, idx) => {
      const children: ColumnsType<AggRow> = [
        {
          title: t('reports.manufacturingProcessDuration'),
          key: `agg-dur-${pc.processId}`,
          align: 'right',
          width: 120,
          render: (_: unknown, row: AggRow) => formatSeconds(row.dur[pc.processId] ?? 0),
        },
      ];
      if (idx < processColumns.length - 1) {
        children.push({
          title: t('reports.manufacturingGapToNext'),
          key: `agg-gap-${pc.processId}`,
          align: 'right',
          width: 130,
          render: (_: unknown, row: AggRow) => {
            const g = row.gap[pc.processId];
            return g == null ? '—' : formatSeconds(g);
          },
        });
      }
      cols.push({ title: `${pc.processCode} — ${pc.processName}`, children });
    });
    cols.push({
      title: t('reports.manufacturingTotal'),
      key: 'agg-total',
      align: 'right',
      width: 160,
      render: (_: unknown, row: AggRow) => formatSeconds(row.total),
    });
    return cols;
  }, [processColumns, t]);

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
        <Select
          mode="multiple"
          placeholder={t('reports.allTypes')}
          value={orderTypes}
          onChange={setOrderTypes}
          allowClear
          style={{ minWidth: 200 }}
          options={orderTypeList?.map((ot: OrderTypeDto) => ({ label: ot.name, value: ot.code }))}
        />
        <Select
          mode="multiple"
          placeholder={t('reports.allCategories')}
          value={productCategoryIds}
          onChange={setProductCategoryIds}
          allowClear
          style={{ minWidth: 220 }}
          options={productCategoryList?.map((c: ProductCategoryDto) => ({
            label: c.name,
            value: c.id,
          }))}
        />
        <Select
          placeholder={t('reports.allComplexities')}
          value={tezina}
          onChange={setTezina}
          allowClear
          style={{ width: 160 }}
          options={[
            { label: t('reports.complexityT'), value: 'T' },
            { label: t('reports.complexityS'), value: 'S' },
            { label: t('reports.complexityL'), value: 'L' },
          ]}
        />
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () => filteredRows}
          columns={[
            { header: t('reports.orderNumber'), value: (r: ProductManufacturingTimeOrderDto) => r.orderNumber, width: 16 },
            { header: t('reports.orderType'), value: (r: ProductManufacturingTimeOrderDto) => orderTypeNameByCode.get(r.orderType.toLowerCase()) ?? r.orderType, width: 14 },
            { header: t('reports.productCategory'), value: (r: ProductManufacturingTimeOrderDto) => r.productCategoryName, width: 22 },
            { header: t('reports.manufacturingTopComplexity'), value: (r: ProductManufacturingTimeOrderDto) => r.topComplexity ?? '—', width: 10 },
            { header: t('reports.manufacturingComplexityShare'), value: (r: ProductManufacturingTimeOrderDto) => r.complexityShare ?? '—', width: 16 },
            ...processColumns.flatMap((pc, idx) => {
              const dur: ExportColumn<ProductManufacturingTimeOrderDto> = {
                header: `${pc.processCode} — ${t('reports.manufacturingProcessDuration')}`,
                value: (r: ProductManufacturingTimeOrderDto) => {
                  const proc = r.processes.find((p) => p.processId === pc.processId);
                  return proc ? formatSeconds(proc.durationSeconds) : '—';
                },
                align: 'right',
                width: 16,
              };
              if (idx === processColumns.length - 1) return [dur];
              const gap: ExportColumn<ProductManufacturingTimeOrderDto> = {
                header: `${pc.processCode} — ${t('reports.manufacturingGapToNext')}`,
                value: (r: ProductManufacturingTimeOrderDto) => {
                  const proc = r.processes.find((p) => p.processId === pc.processId);
                  return proc ? formatSeconds(proc.gapToNextSeconds) : '—';
                },
                align: 'right',
                width: 14,
              };
              return [dur, gap];
            }),
          ] satisfies ExportColumn<ProductManufacturingTimeOrderDto>[]}
          options={{
            fileName: `reports-product-manufacturing-time-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabProductManufacturingTime')}`,
            sheetName: t('reports.tabProductManufacturingTime'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
              ...(orderTypes.length ? [{ label: t('reports.orderType'), value: orderTypes.map((c) => orderTypeNameByCode.get(c.toLowerCase()) ?? c).join(', ') }] : []),
              ...(productCategoryIds.length ? [{ label: t('reports.productCategory'), value: (productCategoryList ?? []).filter((c: ProductCategoryDto) => productCategoryIds.includes(c.id)).map((c: ProductCategoryDto) => c.name).join(', ') }] : []),
            ],
          }}
        />
      </div>

      <Card
        size="small"
        title={t('reports.manufacturingTableTitle')}
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={columns}
          dataSource={filteredRows}
          rowKey="orderItemId"
          loading={isLoading}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: 'max-content' }}
          size="small"
          bordered
        />
      </Card>

      {aggregateRows.length > 0 && (
        <Card
          size="small"
          title={t('reports.manufacturingAggregateTitle')}
          style={{ marginBottom: 16 }}
          extra={
            <TableExportButton
              onFetchAll={async () => aggregateRows}
              columns={[
                { header: t('reports.manufacturingAggregateTitle'), value: (r: AggRow) => r.label, width: 30 },
                ...processColumns.flatMap((pc, idx) => {
                  const dur: ExportColumn<AggRow> = {
                    header: `${pc.processCode} — ${t('reports.manufacturingProcessDuration')}`,
                    value: (r: AggRow) => formatSeconds(r.dur[pc.processId] ?? 0),
                    align: 'right',
                    width: 16,
                  };
                  if (idx === processColumns.length - 1) return [dur];
                  const gap: ExportColumn<AggRow> = {
                    header: `${pc.processCode} — ${t('reports.manufacturingGapToNext')}`,
                    value: (r: AggRow) => {
                      const g = r.gap[pc.processId];
                      return g == null ? '' : formatSeconds(g);
                    },
                    align: 'right',
                    width: 16,
                  };
                  return [dur, gap];
                }),
                { header: t('reports.manufacturingTotal'), value: (r: AggRow) => formatSeconds(r.total), align: 'right', width: 18 },
              ] satisfies ExportColumn<AggRow>[]}
              options={{
                fileName: `reports-product-manufacturing-aggregate-${dayjs().format('YYYY-MM-DD')}`,
                title: `${t('common:appName')} — ${t('reports.manufacturingAggregateTitle')}`,
                sheetName: t('reports.manufacturingAggregateTitle'),
              }}
            />
          }
        >
          <Table
            columns={aggregateColumns}
            dataSource={aggregateRows}
            rowKey="key"
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
            bordered
          />
        </Card>
      )}

      {/* Composition chart (Excel chart1): the two aggregate rows as
          horizontal stacked bars — each process is a colored duration segment
          and the inter-process gaps are neutral spacers. Visualises how the
          average manufacturing time breaks down by process. */}
      {aggregateRows.length > 0 &&
        processColumns.length > 0 &&
        (() => {
          // Per-process segment palette — a semantic process palette (allowed
          // by the no-hardcoded-color rule, same exception as processStatusColors).
          const processPalette = [
            '#1677ff', '#52c41a', '#faad14', '#eb2f96', '#13c2c2',
            '#722ed1', '#fa8c16', '#2f54eb', '#a0d911', '#f5222d',
            '#531dab', '#c41d7f', '#08979c', '#d48806', '#7cb305',
          ];
          const chartData = aggregateRows.map((row) => {
            const entry: Record<string, number | string> = {
              label: row.label,
              // Saša 08.06.2026 (Bug 3): show the row total at the end
              // of the horizontal bar. Read via LabelList on the last
              // Bar — see comment below.
              total: row.total,
            };
            processColumns.forEach((pc) => {
              entry[`dur-${pc.processId}`] = row.dur[pc.processId] ?? 0;
              entry[`gap-${pc.processId}`] = row.gap[pc.processId] ?? 0;
            });
            return entry;
          });
          // Width budget for the right-side total label — increase the
          // chart's right margin so the label has room to render.
          return (
            <Card size="small" title={t('reports.manufacturingChartTitle')}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 80, left: 16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v: number) => formatSeconds(v)} />
                  <YAxis type="category" dataKey="label" width={300} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: token.colorBgElevated,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadiusLG,
                      color: token.colorText,
                    }}
                    labelStyle={{ color: token.colorText, fontWeight: 600 }}
                    itemStyle={{ color: token.colorText }}
                    cursor={{ fill: token.colorFillTertiary }}
                    shared={false}
                    formatter={(value, name) => [formatSeconds(Number(value)), String(name)]}
                  />
                  <Legend />
                  {processColumns.flatMap((pc, idx) => {
                    const isLast = idx === processColumns.length - 1;
                    return [
                      <Bar
                        key={`dur-${pc.processId}`}
                        dataKey={`dur-${pc.processId}`}
                        name={`${pc.processCode} — ${pc.processName}`}
                        stackId="comp"
                        fill={processPalette[idx % processPalette.length]}
                        maxBarSize={48}
                      >
                        {/* Saša 08.06.2026 (Bug 3): show row total at end
                            of bar. Attached to the very last stack segment
                            (the duration of the last process; gap-after for
                            the last process is skipped above). */}
                        {isLast ? (
                          <LabelList
                            dataKey="total"
                            position="right"
                            formatter={(value) => formatSeconds(Number(value))}
                            style={{ fill: token.colorText, fontSize: 12, fontWeight: 600 }}
                          />
                        ) : null}
                      </Bar>,
                      !isLast ? (
                        <Bar
                          key={`gap-${pc.processId}`}
                          dataKey={`gap-${pc.processId}`}
                          name={t('reports.manufacturingGapToNext')}
                          stackId="comp"
                          fill={token.colorFillSecondary}
                          legendType="none"
                          maxBarSize={48}
                        />
                      ) : null,
                    ];
                  })}
                </BarChart>
              </ResponsiveContainer>
            </Card>
          );
        })()}
    </>
  );
}

// ─── Efikasnost radnog vremena tab ─────────────────────────
// Per-worker per-day: Pravo vreme rada (wall-clock from WorkSessions),
// Aktivno na procesima (wall-clock union of subprocess log ranges — so
// parallel work counts once, per Bojan 25.05.2026), Pauze (worked − active),
// Efikasnost % with color coding only in the table (no chart per spec).

function WorkEfficiencyTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(7, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  const { data: users } = useQuery({
    queryKey: ['users-for-reports', tenantId],
    queryFn: () =>
      usersApi
        .getAll({ role: UserRole.Department, page: 1, pageSize: 100 })
        .then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-work-efficiency',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      userId,
    ],
    queryFn: () =>
      reportsApi
        .getWorkEfficiency({
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          userId,
        })
        .then((r) => r.data.rows),
    enabled: !!tenantId,
  });

  const rows = useMemo<WorkEfficiencyRowDto[]>(() => data ?? [], [data]);

  const formatMinutesAsHM = (m: number): string => {
    if (m <= 0) return '0h 00m';
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return `${h}h ${String(min).padStart(2, '0')}m`;
  };

  // Color thresholds per Bojan (R79): ≥80 green, 60–79 yellow, <60 red.
  const effColor = (pct: number): string => {
    if (pct >= 80) return token.colorSuccessBg;
    if (pct >= 60) return token.colorWarningBg;
    return token.colorErrorBg;
  };
  const effTextColor = (pct: number): string => {
    if (pct >= 80) return token.colorSuccessText;
    if (pct >= 60) return token.colorWarningText;
    return token.colorErrorText;
  };
  // Status per R79: ≥80 Odlično, 60–79 Prihvatljivo, 40–59 Ispod norme, <40 Neprihvatljivo.
  const statusLabel = (pct: number): string =>
    pct >= 80
      ? t('reports.statusExcellent')
      : pct >= 60
      ? t('reports.statusAcceptable')
      : pct >= 40
      ? t('reports.statusBelowNorm')
      : t('reports.statusUnacceptable');

  // Per-WORKER aggregate (Excel Table 2, Sale/Bojan 29.05.2026). Daily detail
  // lives in the "Sati radnika" tab.
  const columns: ColumnsType<WorkEfficiencyRowDto> = useMemo(
    () => [
      { title: t('reports.workerName'), dataIndex: 'fullName', fixed: 'left', width: 180, sorter: (a, b) => a.fullName.localeCompare(b.fullName) },
      { title: t('reports.loggedHours'), dataIndex: 'loggedMinutes', align: 'right', sorter: (a, b) => a.loggedMinutes - b.loggedMinutes, render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.effectiveHours'), dataIndex: 'effectiveMinutes', align: 'right', sorter: (a, b) => a.effectiveMinutes - b.effectiveMinutes, render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.activeHours'), dataIndex: 'activeOnProcessesMinutes', align: 'right', sorter: (a, b) => a.activeOnProcessesMinutes - b.activeOnProcessesMinutes, render: (v: number) => formatMinutesAsHM(v) },
      { title: t('reports.uncoveredHours'), dataIndex: 'uncoveredMinutes', align: 'right', sorter: (a, b) => a.uncoveredMinutes - b.uncoveredMinutes, render: (v: number) => formatMinutesAsHM(v) },
      {
        title: t('reports.efficiencyPercent'),
        dataIndex: 'efficiencyPercent',
        align: 'right',
        width: 130,
        sorter: (a, b) => a.efficiencyPercent - b.efficiencyPercent,
        defaultSortOrder: 'descend',
        render: (v: number) => (
          <div
            style={{
              backgroundColor: effColor(v),
              color: effTextColor(v),
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 600,
              textAlign: 'right',
            }}
          >
            {v.toFixed(1)}%
          </div>
        ),
      },
      { title: t('reports.efficiencyStatus'), key: 'status', width: 130, render: (_: unknown, r: WorkEfficiencyRowDto) => statusLabel(r.efficiencyPercent) },
    ],
    [t, token],
  );

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
        <Select
          placeholder={t('reports.allWorkers')}
          value={userId}
          onChange={setUserId}
          allowClear
          style={{ width: 220 }}
          showSearch
          optionFilterProp="label"
          options={users?.map((u: UserDto) => ({
            label: `${u.firstName} ${u.lastName}`,
            value: u.id,
          }))}
        />
      </Space>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <TableExportButton
          onFetchAll={async () => rows}
          columns={[
            { header: t('reports.workerName'), value: (r: WorkEfficiencyRowDto) => r.fullName, width: 22 },
            { header: `${t('reports.loggedHours')} (min)`, value: (r: WorkEfficiencyRowDto) => r.loggedMinutes, align: 'right', width: 16 },
            { header: `${t('reports.effectiveHours')} (min)`, value: (r: WorkEfficiencyRowDto) => r.effectiveMinutes, align: 'right', width: 16 },
            { header: `${t('reports.activeHours')} (min)`, value: (r: WorkEfficiencyRowDto) => r.activeOnProcessesMinutes, align: 'right', width: 16 },
            { header: `${t('reports.uncoveredHours')} (min)`, value: (r: WorkEfficiencyRowDto) => r.uncoveredMinutes, align: 'right', width: 14 },
            { header: t('reports.efficiencyPercent'), value: (r: WorkEfficiencyRowDto) => r.efficiencyPercent, align: 'right', width: 12 },
            { header: t('reports.efficiencyStatus'), value: (r: WorkEfficiencyRowDto) => statusLabel(r.efficiencyPercent), width: 16 },
          ] satisfies ExportColumn<WorkEfficiencyRowDto>[]}
          options={{
            fileName: `reports-work-efficiency-${dayjs().format('YYYY-MM-DD')}`,
            title: `${t('common:appName')} — ${t('reports.tabWorkEfficiency')}`,
            sheetName: t('reports.tabWorkEfficiency'),
            filters: [
              { label: t('export.dateFrom'), value: dateRange[0].format('DD.MM.YYYY.') },
              { label: t('export.dateTo'), value: dateRange[1].format('DD.MM.YYYY.') },
              ...(userId ? [{ label: t('reports.workerName'), value: users?.find((u: UserDto) => u.id === userId)?.fullName ?? userId }] : []),
            ],
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="userId"
        loading={isLoading}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        size="small"
        bordered
        style={{ marginBottom: 16 }}
      />

      {/* Two charts per Excel (Sale/Bojan 29.05.2026), below the table:
          Grafikon 3 = stacked Aktivno vs Nepokriveno (h) per worker;
          Grafikon 4 = Efikasnost (%) per worker, colored by threshold. */}
      {rows.length > 0 &&
        (() => {
          const distData = rows.map((r) => ({
            fullName: r.fullName,
            active: Number((r.activeOnProcessesMinutes / 60).toFixed(2)),
            uncovered: Number((r.uncoveredMinutes / 60).toFixed(2)),
          }));
          const effData = rows
            .map((r) => ({ fullName: r.fullName, eff: r.efficiencyPercent }))
            .slice()
            .sort((a, b) => b.eff - a.eff);
          const barColor = (pct: number) =>
            pct >= 80 ? token.colorSuccess : pct >= 60 ? token.colorWarning : token.colorError;
          // Vertical bars (Excel-match) per Bojan/Sale 06.06.2026 — earlier
          // approved horizontal-bar deviation (29.05) reversed. Height stays
          // fixed since the X axis grows with worker count, not the bar count.
          const chartHeight = 360;
          const tooltipStyle = {
            contentStyle: {
              backgroundColor: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              color: token.colorText,
            },
            labelStyle: { color: token.colorText, fontWeight: 600 },
            itemStyle: { color: token.colorText },
            cursor: { fill: token.colorFillTertiary },
          };
          return (
            <>
              <Card size="small" title={t('reports.chartWorkDistribution')} style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={distData} margin={{ top: 8, right: 24, left: 16, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="fullName"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis tickFormatter={(v: number) => `${v}h`} />
                    <RechartsTooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        `${Number(value).toFixed(2)}h`,
                        name === 'active' ? t('reports.activeHours') : t('reports.uncoveredHours'),
                      ]}
                    />
                    <Legend
                      formatter={(v) => (v === 'active' ? t('reports.activeHours') : t('reports.uncoveredHours'))}
                    />
                    <Bar dataKey="active" name="active" stackId="dist" fill={token.colorSuccess} maxBarSize={48} />
                    <Bar dataKey="uncovered" name="uncovered" stackId="dist" fill={token.colorWarning} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card size="small" title={t('reports.efficiencyChartTitle')}>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={effData} margin={{ top: 8, right: 24, left: 16, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="fullName"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <RechartsTooltip
                      {...tooltipStyle}
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, t('reports.efficiencyPercent')]}
                    />
                    <Bar dataKey="eff" maxBarSize={48}>
                      {effData.map((d) => (
                        <Cell key={d.fullName} fill={barColor(d.eff)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          );
        })()}
    </>
  );
}

// ─── Main Reports Page ─────────────────────────────────

export function ReportsPage() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <PageHeader title={t('reports.title')} />
      <Tabs
        defaultActiveKey="averages"
        destroyOnHidden
        items={[
          {
            key: 'averages',
            label: t('reports.tabAverages'),
            children: <ProcessAveragesTab />,
          },
          {
            key: 'tracking',
            label: t('reports.tabTimeTracking'),
            children: <TimeTrackingTab />,
          },
          {
            key: 'workers',
            label: t('reports.tabWorkerHours'),
            children: <WorkerHoursTab />,
          },
          {
            key: 'blocks',
            label: t('reports.tabBlocksPerProcess'),
            children: <BlocksPerProcessTab />,
          },
          {
            key: 'manufacturing',
            label: t('reports.tabProductManufacturingTime'),
            children: <ProductManufacturingTimeTab />,
          },
          {
            key: 'efficiency',
            label: t('reports.tabWorkEfficiency'),
            children: <WorkEfficiencyTab />,
          },
        ]}
      />
    </div>
  );
}
