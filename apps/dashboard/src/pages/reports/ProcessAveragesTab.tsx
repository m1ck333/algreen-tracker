import { useState, useMemo } from 'react';
import { Card, Select, Space, DatePicker, Table, Empty, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import {
  reportsApi,
  productCategoriesApi,
  orderTypesApi,
} from '@alblue/api-client';
import type {
  ProcessTimeItemDto,
  ProductCategoryDto,
  OrderTypeDto,
} from '@alblue/shared-types';
import { ComplexityType } from '@alblue/shared-types';
import dayjs from 'dayjs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { formatMinutes, COMPLEXITY_ORDER } from './reportsHelpers';
import { ProcessTimeTrendChart } from './ProcessTimeTrendChart';
import { DeliveryComplianceChart } from './DeliveryComplianceChart';
import { ActiveProcessFunnelChart } from './ActiveProcessFunnelChart';

const { RangePicker } = DatePicker;

export function ProcessAveragesTab() {
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
