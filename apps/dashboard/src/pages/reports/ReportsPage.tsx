import { useState, useMemo } from 'react';
import { Tabs, Table, Select, DatePicker, Card, Statistic, Row, Col, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';
import { reportsApi } from '@algreen/api-client';
import { processesApi } from '@algreen/api-client';
import { usersApi } from '@algreen/api-client';
import type {
  ProcessAverageDto,
  TimeTrackingItemDto,
  WorkerHoursDto,
  ProcessDto,
  UserDto,
} from '@algreen/shared-types';
import { UserRole, ComplexityType } from '@algreen/shared-types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// ─── Helper ────────────────────────────────────────────

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0min';
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = Math.round(totalMinutes % 60);
  if (d > 0) {
    if (h === 0 && m === 0) return `${d}d`;
    if (m === 0) return `${d}d ${h}h`;
    return `${d}d ${h}h ${m}min`;
  }
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── Process Averages Tab ──────────────────────────────

function ProcessAveragesTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');

  const { data, isLoading } = useQuery({
    queryKey: ['reports-process-averages', tenantId],
    queryFn: () => reportsApi.getProcessAverages(tenantId!).then((r) => r.data.processes),
    enabled: !!tenantId,
  });

  const complexities: ComplexityType[] = [ComplexityType.T, ComplexityType.S, ComplexityType.L];
  const complexityLabels: Record<string, string> = {
    T: t('reports.complexityT'),
    S: t('reports.complexityS'),
    L: t('reports.complexityL'),
  };

  const columns: ColumnsType<ProcessAverageDto> = useMemo(
    () => [
      {
        title: t('reports.processCode'),
        dataIndex: 'processCode',
        width: 60,
        sorter: (a, b) => a.processCode.localeCompare(b.processCode),
      },
      {
        title: t('reports.processName'),
        dataIndex: 'processName',
      },
      ...complexities.map((c) => ({
        title: `${complexityLabels[c]} — ${t('reports.avg')}`,
        key: `avg-${c}`,
        render: (_: unknown, record: ProcessAverageDto) => {
          const avg = record.averages[c];
          if (!avg) return '—';
          return formatMinutes(avg.avgMinutes);
        },
      })),
      ...complexities.map((c) => ({
        title: `${complexityLabels[c]} — ${t('reports.count')}`,
        key: `count-${c}`,
        width: 80,
        render: (_: unknown, record: ProcessAverageDto) => {
          const avg = record.averages[c];
          return avg ? avg.count : 0;
        },
      })),
    ],
    [t],
  );

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="processId"
      loading={isLoading}
      pagination={false}
      size="small"
      bordered
    />
  );
}

// ─── Time Tracking Tab ─────────────────────────────────

function TimeTrackingTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [processId, setProcessId] = useState<string | undefined>(undefined);
  const [complexity, setComplexity] = useState<string | undefined>(undefined);

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll({ tenantId: tenantId! }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports-time-tracking',
      tenantId,
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      processId,
      complexity,
    ],
    queryFn: () =>
      reportsApi
        .getTimeTracking({
          tenantId: tenantId!,
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          processId,
          complexity,
        })
        .then((r) => r.data),
    enabled: !!tenantId,
  });

  const columns: ColumnsType<TimeTrackingItemDto> = useMemo(
    () => [
      {
        title: t('reports.orderNumber'),
        dataIndex: 'orderNumber',
      },
      {
        title: t('reports.productName'),
        dataIndex: 'productName',
      },
      {
        title: t('reports.processName'),
        dataIndex: 'processName',
        render: (text: string, record) => `${record.processCode} — ${text}`,
      },
      {
        title: t('reports.complexity'),
        dataIndex: 'complexity',
        width: 100,
      },
      {
        title: t('reports.startedAt'),
        dataIndex: 'startedAt',
        render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—'),
      },
      {
        title: t('reports.completedAt'),
        dataIndex: 'completedAt',
        render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—'),
      },
      {
        title: t('reports.duration'),
        dataIndex: 'totalDurationMinutes',
        width: 100,
        sorter: (a, b) => a.totalDurationMinutes - b.totalDurationMinutes,
        render: (v: number) => formatMinutes(v),
      },
    ],
    [t],
  );

  return (
    <>
      {/* Filters */}
      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) setDateRange([vals[0], vals[1]]);
          }}
          format="DD.MM.YYYY"
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
          style={{ width: 140 }}
          options={[
            { label: `T — ${t('reports.complexityT')}`, value: 'T' },
            { label: `S — ${t('reports.complexityS')}`, value: 'S' },
            { label: `L — ${t('reports.complexityL')}`, value: 'L' },
          ]}
        />
      </Space>

      {/* Summary cards */}
      {data?.summary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic title={t('reports.totalItems')} value={data.summary.totalRecords} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title={t('reports.totalTime')}
                value={formatMinutes(data.summary.totalDurationMinutes)}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title={t('reports.averageTime')}
                value={formatMinutes(data.summary.avgDurationMinutes)}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data?.items}
        rowKey="orderItemProcessId"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        bordered
      />
    </>
  );
}

// ─── Worker Hours Tab ──────────────────────────────────

function WorkerHoursTab() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { t } = useTranslation('dashboard');

  const defaultRange: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs().subtract(30, 'day'), dayjs()];
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(defaultRange);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ['users', tenantId],
    queryFn: () =>
      usersApi
        .getAll({ tenantId: tenantId!, role: UserRole.Department, page: 1, pageSize: 100 })
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
          tenantId: tenantId!,
          from: dateRange[0].format('YYYY-MM-DD'),
          to: dateRange[1].format('YYYY-MM-DD'),
          userId,
        })
        .then((r) => r.data.workers),
    enabled: !!tenantId,
  });

  const columns: ColumnsType<WorkerHoursDto> = useMemo(
    () => [
      {
        title: t('reports.workerName'),
        dataIndex: 'fullName',
      },
      {
        title: t('reports.totalHours'),
        dataIndex: 'totalMinutes',
        sorter: (a, b) => a.totalMinutes - b.totalMinutes,
        defaultSortOrder: 'descend',
        render: (v: number) => formatMinutes(v),
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
          return formatMinutes(record.totalMinutes / days);
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
        render: (v: number) => formatMinutes(v),
      },
      {
        title: t('reports.sessionCount'),
        dataIndex: 'sessionCount',
      },
    ],
    [t],
  );

  return (
    <>
      {/* Filters */}
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

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="userId"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
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
        destroyInactiveTabPane
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
