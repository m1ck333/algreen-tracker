import { useState, useMemo } from 'react';
import { Card, Select, DatePicker, Space, Table, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi, usersApi } from '@alblue/api-client';
import type { WorkEfficiencyRowDto, UserDto } from '@alblue/shared-types';
import { UserRole } from '@alblue/shared-types';
import dayjs from 'dayjs';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TableExportButton } from '../../components/TableExportButton';
import type { ExportColumn } from '../../utils/exportTable';

const { RangePicker } = DatePicker;
export function WorkEfficiencyTab() {
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

