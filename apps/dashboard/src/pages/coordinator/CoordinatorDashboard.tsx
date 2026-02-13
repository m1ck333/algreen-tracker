import { Row, Col, Card, Typography, Table, Spin, Alert, Statistic, List, Tag, Badge, Tooltip } from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  StopOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import {
  useDashboardWarnings,
  useDashboardLiveView,
  useDashboardWorkersStatus,
  useDashboardPendingBlocks,
  useDashboardStatistics,
} from '../../hooks/useDashboard';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function CoordinatorDashboard() {
  const warnings = useDashboardWarnings();
  const liveView = useDashboardLiveView();
  const workers = useDashboardWorkersStatus();
  const pendingBlocks = useDashboardPendingBlocks();
  const statistics = useDashboardStatistics();
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <Title level={4}>{t('coordinator.title')}</Title>

      <Row gutter={[16, 16]}>
        {/* Statistics */}
        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined /> {t('coordinator.statistics')}</>} loading={statistics.isLoading}>
            {statistics.data ? (() => {
              const s = statistics.data as {
                today?: { ordersCompleted?: number; ordersActive?: number; processesCompleted?: number; averageProcessTimeMinutes?: number };
                warnings?: { criticalCount?: number; warningCount?: number };
                pendingBlockRequests?: number;
              };
              return (
                <Row gutter={[16, 16]}>
                  <Col span={6}><Statistic title={t('coordinator.stats.ordersActive')} value={s.today?.ordersActive ?? 0} /></Col>
                  <Col span={6}><Statistic title={t('coordinator.stats.ordersCompleted')} value={s.today?.ordersCompleted ?? 0} /></Col>
                  <Col span={6}><Statistic title={t('coordinator.stats.processesCompleted')} value={s.today?.processesCompleted ?? 0} /></Col>
                  <Col span={6}><Statistic title={t('coordinator.stats.avgProcessTime')} value={s.today?.averageProcessTimeMinutes ?? 0} suffix={t('coordinator.stats.min')} /></Col>
                  <Col span={8}><Statistic title={t('coordinator.stats.criticalWarnings')} value={s.warnings?.criticalCount ?? 0} valueStyle={s.warnings?.criticalCount ? { color: '#cf1322' } : undefined} /></Col>
                  <Col span={8}><Statistic title={t('coordinator.stats.warnings')} value={s.warnings?.warningCount ?? 0} valueStyle={s.warnings?.warningCount ? { color: '#faad14' } : undefined} /></Col>
                  <Col span={8}><Statistic title={t('coordinator.stats.pendingBlockRequests')} value={s.pendingBlockRequests ?? 0} /></Col>
                </Row>
              );
            })() : (
              !statistics.isLoading && <Alert message={t('coordinator.noStatistics')} type="info" />
            )}
          </Card>
        </Col>

        {/* Deadline Warnings */}
        <Col xs={24} lg={12}>
          <Card
            title={<><WarningOutlined /> {t('coordinator.deadlineWarnings')}</>}
            loading={warnings.isLoading}
          >
            {Array.isArray(warnings.data) && warnings.data.length > 0 ? (
              <List
                size="small"
                dataSource={warnings.data}
                renderItem={(item: Record<string, unknown>) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.orderNumber as string}
                      description={t('coordinator.daysRemaining', { count: item.daysRemaining as number })}
                    />
                    <Tag color={item.level === 'Critical' ? 'red' : 'orange'}>
                      {item.level as string}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              !warnings.isLoading && <Alert message={t('coordinator.noWarnings')} type="success" />
            )}
          </Card>
        </Col>

        {/* Live View */}
        <Col xs={24}>
          <Card title={<><ClockCircleOutlined /> {t('coordinator.liveView')}</>} loading={liveView.isLoading || workers.isLoading}>
            {Array.isArray(liveView.data) && liveView.data.length > 0 ? (
              <Table
                size="small"
                dataSource={liveView.data}
                rowKey={(r: Record<string, unknown>) => r.processId as string}
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: t('coordinator.liveProcess'),
                    key: 'process',
                    render: (_: unknown, r: Record<string, unknown>) => (
                      <>{r.processCode} — {r.processName}</>
                    ),
                  },
                  {
                    title: t('coordinator.liveWorkers'),
                    key: 'workers',
                    width: 60,
                    align: 'center' as const,
                    render: (_: unknown, r: Record<string, unknown>) => {
                      const workersList = Array.isArray(workers.data) ? workers.data as Record<string, unknown>[] : [];
                      const match = workersList.find((w) => w.processId === r.processId);
                      const isOnline = !!(match as Record<string, unknown> | undefined)?.isWorkerCheckedIn;
                      const worker = (match as Record<string, unknown> | undefined)?.worker as Record<string, unknown> | null;
                      const tooltip = isOnline && worker
                        ? `${worker.name} — ${t('coordinator.workerOnline')}`
                        : t('coordinator.workerOffline');
                      return (
                        <Tooltip title={tooltip}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: isOnline ? '#52c41a' : '#ff4d4f' }} />
                        </Tooltip>
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
                  {
                    title: t('coordinator.liveActiveOrders'),
                    key: 'activeOrders',
                    render: (_: unknown, r: Record<string, unknown>) => {
                      const orders = r.activeOrders as Record<string, unknown>[];
                      if (!Array.isArray(orders) || orders.length === 0) {
                        return <Typography.Text type="secondary">{t('coordinator.liveNoActiveOrders')}</Typography.Text>;
                      }
                      return orders.map((o) => (
                        <Tag key={o.orderNumber as string}>{o.orderNumber as string}</Tag>
                      ));
                    },
                  },
                ]}
              />
            ) : (
              !liveView.isLoading && <Alert message={t('coordinator.noLiveData')} type="info" />
            )}
          </Card>
        </Col>

        {/* Pending Blocks */}
        <Col xs={24}>
          <Card title={<><StopOutlined /> {t('coordinator.pendingBlocks')}</>} loading={pendingBlocks.isLoading}>
            {Array.isArray(pendingBlocks.data) && pendingBlocks.data.length > 0 ? (
              <List
                size="small"
                dataSource={pendingBlocks.data}
                renderItem={(item: Record<string, unknown>) => (
                  <List.Item>
                    <List.Item.Meta
                      title={t('coordinator.blockRequest', { id: (item.id as string)?.slice(0, 8) })}
                      description={item.requestNote as string}
                    />
                    <Tag color="warning">{t('coordinator.pending')}</Tag>
                  </List.Item>
                )}
              />
            ) : (
              !pendingBlocks.isLoading && <Alert message={t('coordinator.noPendingBlocks')} type="success" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
