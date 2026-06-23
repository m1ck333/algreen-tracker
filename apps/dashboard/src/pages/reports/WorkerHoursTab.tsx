import { useState, useMemo } from 'react';
import { Table, Select, DatePicker, Space, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { reportsApi, usersApi } from '@alblue/api-client';
import type { WorkerHoursDto, UserDto } from '@alblue/shared-types';
import { UserRole } from '@alblue/shared-types';
import dayjs from 'dayjs';
import { TableExportButton } from '../../components/TableExportButton';
import { useFixedColumn } from '../../hooks/useFixedColumn';
import { useFilterWidth } from '../../hooks/useFilterWidth';

const { RangePicker } = DatePicker;

export function WorkerHoursTab() {
  const fixedCol = useFixedColumn();
  const filterW = useFilterWidth();
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
      { title: t('reports.workerName'), dataIndex: 'fullName', fixed: fixedCol('left'), width: 180 },
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
          style={{ width: filterW(220) }}
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
