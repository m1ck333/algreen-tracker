import { Typography, Row, Col, Card, Table, Tag, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ordersApi, changeRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

export function SalesDashboard() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => ordersApi.getAll({ tenantId: tenantId! }).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const { data: changeRequests, isLoading: crLoading } = useQuery({
    queryKey: ['change-requests', 'my', userId],
    queryFn: () => changeRequestsApi.getMy(userId!).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!userId,
  });

  return (
    <div>
      <Title level={4}>{t('sales.title')}</Title>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title={t('sales.myOrders')} loading={ordersLoading}>
            <Table
              dataSource={orders}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: t('orders.orderNumber'), dataIndex: 'orderNumber' },
                { title: t('common:labels.type'), dataIndex: 'orderType', render: (ot) => <Tag>{tEnum('OrderType', ot)}</Tag> },
                { title: t('common:labels.status'), dataIndex: 'status', render: (s) => <StatusBadge status={s} /> },
                {
                  title: t('sales.delivery'),
                  dataIndex: 'deliveryDate',
                  render: (d) => dayjs(d).format('DD.MM.YYYY'),
                },
                { title: t('common:labels.items'), dataIndex: 'itemCount' },
              ]}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title={t('sales.myChangeRequests')} loading={crLoading}>
            <Table
              dataSource={changeRequests}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: t('common:labels.type'), dataIndex: 'requestType', render: (rt) => <Tag>{tEnum('ChangeRequestType', rt)}</Tag> },
                { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
                { title: t('common:labels.status'), dataIndex: 'status', render: (s) => <StatusBadge status={s} /> },
                {
                  title: t('common:labels.created'),
                  dataIndex: 'createdAt',
                  render: (d) => dayjs(d).format('DD.MM.YYYY HH:mm'),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
