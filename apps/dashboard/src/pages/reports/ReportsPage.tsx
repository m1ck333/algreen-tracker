import { useState, useMemo } from 'react';
import {
  Tabs,
  Table,
  Select,
  DatePicker,
  Card,
  Typography,
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
import { useAuthStore } from '@algreen/auth';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import {
  reportsApi,
  processesApi,
  usersApi,
  productCategoriesApi,
  orderTypesApi,
  processWorkflowApi,
} from '@algreen/api-client';
import type {
  ProcessTimeItemDto,
  TimeTrackingItemDto,
  WorkerHoursDto,
  ProcessDto,
  UserDto,
  ProductCategoryDto,
  OrderTypeDto,
} from '@algreen/shared-types';
import { UserRole, ComplexityType } from '@algreen/shared-types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

dayjs.extend(isoWeek);

const { Title } = Typography;
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
  const orderTypeNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    orderTypeList?.forEach((ot) => map.set(ot.code, ot.name));
    return map;
  }, [orderTypeList]);
  const resolveOrderTypeName = (code: string) => orderTypeNameByCode.get(code) ?? code;
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
        Teško: Number((p.stats[ComplexityType.T]?.trimmedMeanMinutes ?? 0).toFixed(2)),
        Srednje: Number((p.stats[ComplexityType.S]?.trimmedMeanMinutes ?? 0).toFixed(2)),
        Lako: Number((p.stats[ComplexityType.L]?.trimmedMeanMinutes ?? 0).toFixed(2)),
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
              {/* `direction: rtl` reverses the legend item flow so it reads
                  Teško → Srednje → Lako, matching the table column order.
                  Recharts otherwise sorts legend entries alphabetically by
                  dataKey, which is the opposite of our Excel-inherited
                  heaviest-first convention. */}
              <Legend wrapperStyle={{ direction: 'rtl' }} />
              {/* Colors match Sale/Bojan's Excel cover page chart. */}
              <Bar dataKey="Teško" fill="#1890ff" maxBarSize={40} />
              <Bar dataKey="Srednje" fill="#52c41a" maxBarSize={40} />
              <Bar dataKey="Lako" fill="#fa8c16" maxBarSize={40} />
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
// Per Sale/Bojan spec 22.05.2026 + clarification 23.05.2026:
//   • Green zone = MIN/MAX per period bucket (window-clamped — same
//     formula as the Vremena table: smallest sample ≥ μ-σ, largest
//     ≤ μ+σ). Plotted as an Area between minMinutes/maxMinutes.
//   • Blue line = Realni prosek (trimmed mean) per bucket.
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

  const { data: processes } = useQuery({
    queryKey: ['processes-for-reports', tenantId],
    queryFn: () => processesApi.getAll({ pageSize: 100 }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reports-process-time-trend', tenantId, processId, complexity, granularity],
    queryFn: () =>
      reportsApi
        .getProcessTimeTrend({
          processId: processId!,
          complexity: complexity!,
          granularity,
          from: dayjs().subtract(180, 'day').format('YYYY-MM-DD'),
          to: dayjs().format('YYYY-MM-DD'),
        })
        .then((r) => r.data),
    enabled: !!tenantId && !!processId && !!complexity,
  });

  const chartData = useMemo(
    () =>
      (data?.buckets ?? []).map((b) => ({
        bucket: dayjs(b.bucketStart).format(granularity === 'Week' ? 'DD.MM' : 'MM.YYYY'),
        min: Number(b.minMinutes.toFixed(2)),
        max: Number(b.maxMinutes.toFixed(2)),
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
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis
              label={{ value: t('reports.minutesUnit'), angle: -90, position: 'insideLeft' }}
            />
            <RechartsTooltip
              formatter={(value, name) => {
                const formatted = formatMinutes(
                  typeof value === 'number' ? value : Number(value),
                );
                const label =
                  name === 'min'
                    ? t('reports.min')
                    : name === 'max'
                    ? t('reports.max')
                    : name === 'avg'
                    ? t('reports.trimmedAvg')
                    : String(name);
                return [formatted, label];
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
                  : v === 'minMaxBand'
                  ? t('reports.minMaxBand')
                  : v === 'normativ'
                  ? t('reports.normativ')
                  : v
              }
            />
            {/* Green band: render two stacked areas; bottom (transparent) up
                to `min`, second (visible green fill) up to `max`. Recharts
                stacks them so the visible swath is between min and max. */}
            <Area
              type="monotone"
              dataKey="min"
              stackId="band"
              stroke="none"
              fill="transparent"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey={(d: { min: number; max: number }) => d.max - d.min}
              name="minMaxBand"
              stackId="band"
              stroke="none"
              fill="#52c41a"
              fillOpacity={0.2}
            />
            <Line
              type="monotone"
              dataKey="avg"
              name="avg"
              stroke="#1890ff"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            {normativ != null && (
              <ReferenceLine
                y={normativ}
                stroke="#ff4d4f"
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

  const orderTypeNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    orderTypeList?.forEach((ot) => map.set(ot.code, ot.name));
    return map;
  }, [orderTypeList]);
  const resolveOrderTypeName = (code: string) => orderTypeNameByCode.get(code) ?? code;

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

  const columns: ColumnsType<WorkerHoursDto> = useMemo(
    () => [
      { title: t('reports.workerName'), dataIndex: 'fullName' },
      {
        title: t('reports.totalHours'),
        dataIndex: 'totalMinutes',
        sorter: (a, b) => a.totalMinutes - b.totalMinutes,
        defaultSortOrder: 'descend',
        render: (v: number) => formatMinutesAsHM(v),
      },
      {
        title: t('reports.sessionCount'),
        dataIndex: 'sessionCount',
        sorter: (a, b) => a.sessionCount - b.sessionCount,
      },
      {
        title: t('reports.avgPerDay'),
        key: 'avg',
        render: (_: unknown, record: WorkerHoursDto) => {
          const days = record.dailyBreakdown.length;
          if (days === 0) return '—';
          return formatMinutesAsHM(record.totalMinutes / days);
        },
      },
    ],
    [t],
  );

  const dailyColumns: ColumnsType<WorkerHoursDto['dailyBreakdown'][0]> = useMemo(
    () => [
      {
        title: t('reports.date'),
        dataIndex: 'date',
        render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
      },
      {
        title: t('reports.totalHours'),
        dataIndex: 'totalMinutes',
        render: (v: number) => formatMinutesAsHM(v),
      },
      { title: t('reports.sessionCount'), dataIndex: 'sessionCount' },
    ],
    [t],
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
          onFetchAll={async () => data ?? []}
          columns={[
            { header: t('reports.workerName'), value: (w: WorkerHoursDto) => w.fullName, width: 24 },
            { header: `${t('reports.totalHours')} (min)`, value: (w: WorkerHoursDto) => w.totalMinutes, align: 'right', width: 18 },
            { header: t('reports.sessionCount'), value: (w: WorkerHoursDto) => w.sessionCount, align: 'right', width: 14 },
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

// ─── Main Reports Page ─────────────────────────────────

export function ReportsPage() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        {t('reports.title')}
      </Title>
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
        ]}
      />
    </div>
  );
}
