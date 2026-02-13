import { useState } from 'react';
import { Typography, Table, Select, Space, Button, App } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { RequestStatus } from '@algreen/shared-types';
import type { BlockRequestDto } from '@algreen/shared-types';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

export function BlockRequestsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>(undefined);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['block-requests', tenantId, statusFilter],
    queryFn: () => blockRequestsApi.getAll(tenantId!, statusFilter).then((r) => { const d = r.data as any; return Array.isArray(d) ? d : d.items; }),
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      blockRequestsApi.approve(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      message.success(t('blockRequests.approved'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      blockRequestsApi.reject(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      message.success(t('blockRequests.rejected'));
    },
  });

  const columns = [
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      render: (s: RequestStatus) => <StatusBadge status={s} />,
    },
    { title: t('blockRequests.note'), dataIndex: 'requestNote', ellipsis: true },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: t('common:labels.actions'),
      render: (_: unknown, record: BlockRequestDto) =>
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
          {t('blockRequests.title')}
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
