import { useState } from 'react';
import { Typography, Table, Select, Space, Button, App } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changeRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { RequestStatus } from '@algreen/shared-types';
import type { ChangeRequestDto } from '@algreen/shared-types';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

export function ChangeRequestsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>(undefined);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['change-requests', tenantId, statusFilter],
    queryFn: () => changeRequestsApi.getAll(tenantId!, statusFilter).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      changeRequestsApi.approve(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      message.success(t('changeRequests.approved'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      changeRequestsApi.reject(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      message.success(t('changeRequests.rejected'));
    },
  });

  const columns = [
    { title: t('common:labels.type'), dataIndex: 'requestType', render: (rt: string) => <>{tEnum('ChangeRequestType', rt)}</> },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      render: (s: RequestStatus) => <StatusBadge status={s} />,
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: t('common:labels.actions'),
      render: (_: unknown, record: ChangeRequestDto) =>
        record.status === RequestStatus.Pending ? (
          <Space>
            <Button
              type="primary"
              size="small"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(record.id)}
            >
              {t('common:actions.approve')}
            </Button>
            <Button
              danger
              size="small"
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(record.id)}
            >
              {t('common:actions.reject')}
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('changeRequests.title')}
        </Title>
        <Select
          placeholder={t('orders.filterByStatus')}
          allowClear
          style={{ width: 160 }}
          onChange={setStatusFilter}
          options={Object.values(RequestStatus).map((s) => ({ label: tEnum('RequestStatus', s), value: s }))}
        />
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={isLoading} scroll={{ x: 'max-content' }} />
    </div>
  );
}
