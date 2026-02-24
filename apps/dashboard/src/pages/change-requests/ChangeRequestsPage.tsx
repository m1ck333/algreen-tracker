import { useState } from 'react';
import { Typography, Table, Space, Button, App, Popconfirm, Tag } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changeRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { RequestStatus } from '@algreen/shared-types';
import type { ChangeRequestDto } from '@algreen/shared-types';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

function getApiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function getTranslatedError(error: unknown, t: (key: string, opts?: Record<string, string>) => string, fallback: string): string {
  const code = getApiErrorCode(error);
  if (code) {
    const translated = t(`common:errors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return fallback;
}

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
    queryFn: () => changeRequestsApi.getAll(tenantId!, statusFilter).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      changeRequestsApi.approve(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      message.success(t('changeRequests.approved'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('changeRequests.approveFailed'))),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      changeRequestsApi.reject(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      message.success(t('changeRequests.rejected'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('changeRequests.rejectFailed'))),
  });

  const columns = [
    {
      title: t('common:labels.type'),
      dataIndex: 'requestType',
      width: 140,
      render: (rt: string) => <Tag color="blue">{tEnum('ChangeRequestType', rt)}</Tag>,
    },
    { title: t('common:labels.description'), dataIndex: 'description', ellipsis: true },
    {
      title: t('changeRequests.responseNote'),
      dataIndex: 'responseNote',
      ellipsis: true,
      render: (note: string | null, record: ChangeRequestDto) => {
        if (!note) return '—';
        const color = record.status === RequestStatus.Approved ? 'success' : record.status === RequestStatus.Rejected ? 'danger' : undefined;
        return <Typography.Text type={color}>{note}</Typography.Text>;
      },
    },
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      width: 110,
      filters: Object.values(RequestStatus).map((s) => ({ text: tEnum('RequestStatus', s), value: s })),
      filteredValue: statusFilter ? [statusFilter] : null,
      filterMultiple: false,
      render: (s: RequestStatus) => <StatusBadge status={s} />,
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      sorter: (a: ChangeRequestDto, b: ChangeRequestDto) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend' as const,
      render: (d: string) => dayjs(d).format('DD.MM.YYYY. HH:mm'),
    },
    {
      title: t('common:labels.actions'),
      width: 180,
      render: (_: unknown, record: ChangeRequestDto) => {
        if (record.status === RequestStatus.Pending) {
          return (
            <Space>
              <Popconfirm
                title={t('changeRequests.approveConfirm')}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.no')}
                onConfirm={() => approveMutation.mutate(record.id)}
              >
                <Button
                  type="primary"
                  size="small"
                  loading={approveMutation.isPending}
                >
                  {t('common:actions.approve')}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t('changeRequests.rejectConfirm')}
                okText={t('common:actions.confirm')}
                cancelText={t('common:actions.no')}
                onConfirm={() => rejectMutation.mutate(record.id)}
              >
                <Button
                  danger
                  size="small"
                  loading={rejectMutation.isPending}
                >
                  {t('common:actions.reject')}
                </Button>
              </Popconfirm>
            </Space>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>{t('changeRequests.title')}</Title>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 'max-content' }}
        onChange={(_pagination, filters) => {
          const val = filters.status?.[0] as RequestStatus | undefined;
          setStatusFilter(val);
        }}
      />
    </div>
  );
}
