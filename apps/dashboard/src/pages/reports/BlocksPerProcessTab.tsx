import { useState, useMemo } from 'react';
import { Card, DatePicker, Space, Table, Empty, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi } from '@alblue/api-client';
import type { BlocksPerProcessBucketDto } from '@alblue/shared-types';
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

const { RangePicker } = DatePicker;

// Per-process aggregate of block requests. BE computes average duration
// in WORKING HOURS only (intersection with active Shift windows) per
// Bojan spec 25.05.2026 — overnight/weekend gaps don't inflate averages.
// Approved = Approved + Resolved; Rejected counts toward "submitted"
// but contributes zero duration. Two charts: avg duration (h) on the
// left, submitted vs approved on the right.
export function BlocksPerProcessTab() {
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
