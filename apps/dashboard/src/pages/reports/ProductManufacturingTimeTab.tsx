import { useState, useMemo } from 'react';
import { Card, Select, DatePicker, Space, Table, theme } from 'antd';
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
  ProductManufacturingTimeOrderDto,
  ProductCategoryDto,
  OrderTypeDto,
} from '@alblue/shared-types';
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
  LabelList,
} from 'recharts';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';
import { formatSeconds } from './reportsHelpers';
import { useFixedColumn } from '../../hooks/useFixedColumn';
import { useFilterWidth } from '../../hooks/useFilterWidth';

const { RangePicker } = DatePicker;
export function ProductManufacturingTimeTab() {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
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
        fixed: fixedCol('left'),
        width: 140,
      },
      {
        title: t('reports.orderType'),
        dataIndex: 'orderType',
        fixed: fixedCol('left'),
        width: 120,
        render: (code: string) => orderTypeNameByCode.get(code.toLowerCase()) ?? code,
      },
      {
        title: t('reports.productCategory'),
        dataIndex: 'productCategoryName',
        fixed: fixedCol('left'),
        width: 160,
      },
      {
        title: t('reports.manufacturingTopComplexity'),
        dataIndex: 'topComplexity',
        fixed: fixedCol('left'),
        width: 90,
        align: 'center',
        render: (v: string | null) => v ?? t('reports.manufacturingNoComplexity'),
      },
      {
        title: t('reports.manufacturingComplexityShare'),
        dataIndex: 'complexityShare',
        fixed: fixedCol('left'),
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
      { title: t('reports.manufacturingAggregateTitle'), dataIndex: 'label', fixed: fixedCol('left'), width: 280 },
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
          style={{ width: filterW(160) }}
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

