import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Table, Alert, Statistic, List, Tag, Badge, Button, Drawer, theme } from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  StopOutlined,
  BarChartOutlined,
  SwapOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import type {
  DashboardStatisticsDto,
  DeadlineWarningDto,
  LiveViewProcessDto,
  LiveViewOrderDto,
  WorkerStatusDto,
  PendingBlockRequestDto,
  ChangeRequestDto,
} from '@alblue/shared-types';
import {
  useDashboardWarnings,
  useDashboardLiveView,
  useDashboardWorkersStatus,
  useDashboardPendingBlocks,
  useDashboardStatistics,
  usePendingChangeRequests,
  useDashboardSignalRSync,
} from '../../hooks/useDashboard';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { PageHeader } from '../../components/PageHeader';

const { Text } = Typography;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CoordinatorDashboard() {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [activeOrdersProcess, setActiveOrdersProcess] = useState<LiveViewProcessDto | null>(null);
  useDashboardSignalRSync();
  const warnings = useDashboardWarnings();
  const liveView = useDashboardLiveView();
  const workers = useDashboardWorkersStatus();
  const pendingBlocks = useDashboardPendingBlocks();
  const statistics = useDashboardStatistics();
  const changeRequests = usePendingChangeRequests();
  const tenantId = useAuthStore((s) => s.tenantId);
  const stockBalances = useQuery({
    queryKey: ['warehouse-stock', tenantId],
    queryFn: () => warehouseApi.getStockBalances().then((r) => r.data),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });
  const lowStockCount = (stockBalances.data ?? []).filter((b) => b.status === 'BelowMin').length;
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  return (
    <div>
      <PageHeader title={t('coordinator.title')} />

      <Row gutter={[16, 16]} align="stretch">
        {/* Statistics */}
        <Col xs={24} lg={12} style={{ display: 'flex' }}>
          <Card
            title={<><BarChartOutlined /> {t('coordinator.statistics')}</>}
            loading={statistics.isLoading}
            style={{ width: '100%' }}
          >
            {statistics.data ? (() => {
              const s = statistics.data as DashboardStatisticsDto;
              type StatItem = { title: string; value: number; suffix?: string; color?: string; onClick?: () => void };
              // Three semantic groups, each rendered in its own 3-column row
              // with a small muted header above. Groups: Narudžbine (order
              // overview + pending block requests), Upozorenja (alarm cells
              // — deadline + low-stock), Aktivnost danas (today-only
              // output info, no navigation).
              const orderGroup: StatItem[] = [
                {
                  title: t('coordinator.stats.ordersActive'),
                  value: s.today?.ordersActive ?? 0,
                  onClick: () => navigate('/orders'),
                },
                {
                  title: t('coordinator.stats.ordersCompletedToday'),
                  value: s.today?.ordersCompleted ?? 0,
                  onClick: () => navigate('/orders'),
                },
                {
                  title: t('coordinator.stats.pendingBlockRequests'),
                  value: s.pendingBlockRequests ?? 0,
                  color: (s.pendingBlockRequests ?? 0) > 0 ? token.colorWarning : undefined,
                  onClick: () => navigate('/block-requests'),
                },
              ];
              const alarmGroup: StatItem[] = [
                {
                  title: t('coordinator.stats.criticalWarnings'),
                  value: s.warnings?.criticalCount ?? 0,
                  color: s.warnings?.criticalCount ? token.colorError : undefined,
                  onClick: () => navigate('/orders'),
                },
                {
                  title: t('coordinator.stats.warnings'),
                  value: s.warnings?.warningCount ?? 0,
                  color: s.warnings?.warningCount ? token.colorWarning : undefined,
                  onClick: () => navigate('/orders'),
                },
                {
                  title: t('coordinator.stats.lowStock'),
                  value: lowStockCount,
                  color: lowStockCount > 0 ? token.colorError : undefined,
                  onClick: lowStockCount > 0 ? () => navigate('/warehouse/stock?status=BelowMin') : undefined,
                },
              ];
              const activityGroup: StatItem[] = [
                {
                  title: t('coordinator.stats.processesCompletedToday'),
                  value: s.today?.processesCompleted ?? 0,
                },
                {
                  title: t('coordinator.stats.avgProcessTimeToday'),
                  value: Math.round(s.today?.averageProcessTimeMinutes ?? 0),
                  suffix: t('coordinator.stats.min'),
                },
              ];
              const groups: { title: string; items: StatItem[] }[] = [
                { title: t('coordinator.stats.groupOrders'), items: orderGroup },
                { title: t('coordinator.stats.groupAlarms'), items: alarmGroup },
                { title: t('coordinator.stats.groupActivityToday'), items: activityGroup },
              ];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {groups.map((group, gi) => (
                    <div key={group.title}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          color: token.colorTextSecondary,
                          marginBottom: 10,
                          paddingBottom: 6,
                          borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        }}
                      >
                        {group.title}
                      </div>
                      <div className="stats-grid">
                        {group.items.map((item) => (
                          <div
                            key={item.title}
                            onClick={item.onClick}
                            className={item.onClick ? 'stats-clickable-cell' : undefined}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              minHeight: 64,
                              cursor: item.onClick ? 'pointer' : undefined,
                              padding: item.onClick ? '4px 8px' : undefined,
                              margin: item.onClick ? '-4px -8px' : undefined,
                              borderRadius: 6,
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                color: item.onClick ? token.colorPrimary : token.colorTextSecondary,
                                lineHeight: 1.3,
                                marginBottom: 4,
                              }}
                            >
                              {item.title}
                              {item.onClick && (
                                <ArrowRightOutlined
                                  style={{ fontSize: 10, marginLeft: 4, verticalAlign: 'middle' }}
                                />
                              )}
                            </div>
                            <Statistic
                              value={item.value}
                              suffix={item.suffix}
                              valueStyle={{ fontSize: 24, ...(item.color ? { color: item.color } : {}) }}
                            />
                          </div>
                        ))}
                      </div>
                      {gi < groups.length - 1 && null}
                    </div>
                  ))}
                </div>
              );
            })() : (
              !statistics.isLoading && <Alert message={t('coordinator.noStatistics')} type="info" />
            )}
          </Card>
        </Col>

        {/* Deadline Warnings */}
        <Col xs={24} lg={12} style={{ display: 'flex' }}>
          <Card
            title={<><WarningOutlined /> {t('coordinator.deadlineWarnings')}</>}
            loading={warnings.isLoading}
            style={{ width: '100%' }}
          >
            {Array.isArray(warnings.data) && warnings.data.length > 0 ? (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <List
                size="small"
                dataSource={warnings.data as DeadlineWarningDto[]}
                renderItem={(item: DeadlineWarningDto) => {
                  const isOverdue = item.daysRemaining < 0;
                  const daysText = isOverdue
                    ? t('coordinator.daysOverdue', { count: Math.abs(item.daysRemaining) })
                    : t('coordinator.daysRemaining', { count: item.daysRemaining });
                  return (
                  <List.Item>
                    <List.Item.Meta
                      title={item.orderNumber}
                      description={
                        <>
                          <span style={isOverdue ? { color: token.colorError, fontWeight: 500 } : undefined}>
                            {daysText}
                          </span>
                          {' · '}
                          {t('coordinator.deliveryDate')}: {formatDate(item.deliveryDate)}
                          {item.currentProcess && (
                            <> · {t('coordinator.currentProcess')}: {item.currentProcess}</>
                          )}
                        </>
                      }
                    />
                    <Tag color={item.level === 'Critical' ? 'red' : 'orange'}>
                      {item.level === 'Critical' ? t('coordinator.levelCritical') : t('coordinator.levelWarning')}
                    </Tag>
                  </List.Item>
                  );
                }}
              />
              </div>
            ) : (
              !warnings.isLoading && <Alert message={t('coordinator.noWarnings')} type="success" />
            )}
          </Card>
        </Col>

        {/* Live View */}
        <Col xs={24}>
          <Card title={<><ClockCircleOutlined /> {t('coordinator.liveView')}</>} loading={liveView.isLoading || workers.isLoading}>
            {Array.isArray(liveView.data) && liveView.data.length > 0 ? (
              <Table<LiveViewProcessDto>
                size="small"
                dataSource={liveView.data}
                rowKey={(r) => r.processId}
                pagination={false}
                scroll={{ x: 'max-content' }}
                onRow={(record) => ({
                  onClick: () => setActiveOrdersProcess(record),
                  style: { cursor: 'pointer' },
                })}
                columns={[
                  {
                    title: t('coordinator.liveProcess'),
                    key: 'process',
                    render: (_, r) => (
                      <>{r.processCode} — {r.processName}</>
                    ),
                  },
                  {
                    title: t('coordinator.liveWorkers'),
                    key: 'workers',
                    width: 220,
                    render: (_, r) => {
                      const workersList = Array.isArray(workers.data) ? workers.data as WorkerStatusDto[] : [];
                      const processWorkers = workersList.filter((w) => w.assignedProcessCodes?.includes(r.processCode));
                      if (processWorkers.length === 0) {
                        return <Text type="secondary" style={{ fontSize: 13 }}>{t('coordinator.workerOffline')}</Text>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {processWorkers.map((w) => (
                            <div key={w.userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: w.isCheckedIn ? token.colorSuccess : token.colorError, flexShrink: 0 }} />
                              <Text style={{ fontSize: 13 }}>
                                {w.name}
                                {w.isCheckedIn && w.checkedInAt && (
                                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                                    ({formatTime(w.checkedInAt)})
                                  </Text>
                                )}
                              </Text>
                            </div>
                          ))}
                        </div>
                      );
                    },
                  },
                  {
                    title: t('coordinator.liveQueue'),
                    dataIndex: 'queueCount',
                    key: 'queueCount',
                    width: 90,
                    align: 'center' as const,
                    render: (v: number) => <Badge count={v} showZero color={v > 0 ? 'blue' : 'default'} />,
                  },
                  {
                    title: t('coordinator.liveInProgress'),
                    dataIndex: 'inProgressCount',
                    key: 'inProgressCount',
                    width: 100,
                    align: 'center' as const,
                    render: (v: number) => <Badge count={v} showZero color={v > 0 ? 'green' : 'default'} />,
                  },
                ]}
              />
            ) : (
              !liveView.isLoading && <Alert message={t('coordinator.noLiveData')} type="info" />
            )}
          </Card>
        </Col>

        {/* Pending Blocks */}
        <Col xs={24} lg={12}>
          <Card title={<><StopOutlined /> {t('coordinator.pendingBlocks')}</>} loading={pendingBlocks.isLoading}>
            {Array.isArray(pendingBlocks.data) && pendingBlocks.data.length > 0 ? (
              <List
                size="small"
                dataSource={pendingBlocks.data as PendingBlockRequestDto[]}
                renderItem={(item: PendingBlockRequestDto) => (
                  <List.Item
                    extra={
                      <div style={{ textAlign: 'right', fontSize: 12, color: token.colorTextSecondary }}>
                        <div>{item.requestedBy}</div>
                        <div>{formatDateTime(item.requestedAt)}</div>
                      </div>
                    }
                  >
                    <List.Item.Meta
                      title={<>{item.orderNumber} — {item.processName}</>}
                      description={
                        <>
                          {item.productName}
                          {item.requestNote && <> · {item.requestNote}</>}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              !pendingBlocks.isLoading && <Alert message={t('coordinator.noPendingBlocks')} type="success" />
            )}
          </Card>
        </Col>

        {/* Pending Change Requests */}
        <Col xs={24} lg={12}>
          <Card
            title={<><SwapOutlined /> {t('coordinator.pendingChangeRequests')}</>}
            loading={changeRequests.isLoading}
            extra={
              Array.isArray(changeRequests.data) && changeRequests.data.length > 0
                ? <Button type="link" size="small" onClick={() => navigate('/change-requests')}>{t('coordinator.viewAll')}</Button>
                : undefined
            }
          >
            {Array.isArray(changeRequests.data) && changeRequests.data.length > 0 ? (
              <List
                size="small"
                dataSource={(changeRequests.data as ChangeRequestDto[]).slice(0, 5)}
                renderItem={(item: ChangeRequestDto) => (
                  <List.Item
                    extra={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(item.createdAt)}
                      </Text>
                    }
                  >
                    <List.Item.Meta
                      title={<Tag color="blue">{tEnum('ChangeRequestType', item.requestType)}</Tag>}
                      description={item.description}
                    />
                  </List.Item>
                )}
              />
            ) : (
              !changeRequests.isLoading && <Alert message={t('coordinator.noPendingChangeRequests')} type="success" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Active Orders Drawer */}
      <Drawer
        title={activeOrdersProcess ? `${activeOrdersProcess.processCode} — ${activeOrdersProcess.processName}` : ''}
        open={!!activeOrdersProcess}
        onClose={() => setActiveOrdersProcess(null)}
        width={480}
      >
        {activeOrdersProcess && Array.isArray(activeOrdersProcess.activeOrders) && (
          <List
            size="small"
            dataSource={activeOrdersProcess.activeOrders as LiveViewOrderDto[]}
            renderItem={(o: LiveViewOrderDto, idx: number) => (
              <List.Item key={o.orderItemId ?? idx}>
                <List.Item.Meta
                  title={
                    <>{o.orderNumber} · {o.productName}</>
                  }
                  description={
                    <>
                      <Tag color={o.status === 'InProgress' ? 'green' : o.status === 'Pending' ? 'default' : 'blue'}>
                        {tEnum('ProcessStatus', o.status)}
                      </Tag>
                      {o.isBlocked && (
                        <Tag color="red" icon={<StopOutlined />} style={{ borderStyle: 'dashed' }}>
                          {t('coordinator.blocked')}{o.blockReason ? `: ${o.blockReason}` : ''}
                        </Tag>
                      )}
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}
