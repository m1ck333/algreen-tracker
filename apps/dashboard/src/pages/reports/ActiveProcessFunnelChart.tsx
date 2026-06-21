import { useState, useMemo } from 'react';
import { Card, Select, Space, Empty, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi, orderTypesApi } from '@alblue/api-client';
import { ComplexityType } from '@alblue/shared-types';
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

// Horizontal bar per process, with three stacked segments:
//   • U toku (blue)            — InProgress
//   • Spreman za izvršavanje (gray) — Pending + all deps complete
//   • Blokirano (red)          — Blocked
// Sale/Bojan clarified 23.05.2026: the gray "Na čekanju" label in the
// mock was wrong; the gray boldirani kvadratić in live order tracking
// represents "spreman za izvršavanje", and that's what the gray here is.
// Pending-but-waiting-on-deps rows are excluded — the chart only shows
// rows that are actively in the pipeline for that process.
export function ActiveProcessFunnelChart() {
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
