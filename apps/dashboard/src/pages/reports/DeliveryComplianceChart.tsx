import { useState, useMemo } from 'react';
import { Card, Select, Space, Empty, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi, orderTypesApi } from '@alblue/api-client';
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
import { useFilterWidth } from '../../hooks/useFilterWidth';

// 100% stacked bar per period bucket (week/month): green = % completed
// on time (CompletedAt ≤ DeliveryDate, day-precision), red = % completed
// late. Per-tenant order-type filter. Sale/Bojan spec 22.05.2026.
export function DeliveryComplianceChart() {
  const filterW = useFilterWidth();
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
          style={{ width: filterW(140) }}
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
