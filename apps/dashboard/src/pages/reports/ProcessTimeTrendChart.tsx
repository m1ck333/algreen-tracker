import { useState, useMemo, useEffect } from 'react';
import { Card, Select, Space, Empty, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi, processesApi } from '@alblue/api-client';
import type { ProcessDto } from '@alblue/shared-types';
import { ComplexityType } from '@alblue/shared-types';
import dayjs from 'dayjs';
import {
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
} from 'recharts';
import { formatMinutes } from './reportsHelpers';

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
export function ProcessTimeTrendChart() {
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
