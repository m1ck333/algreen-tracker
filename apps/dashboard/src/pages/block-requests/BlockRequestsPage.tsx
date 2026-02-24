import { useState } from 'react';
import { Typography, Table, Space, Button, App, Popconfirm, Modal, Input } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { RequestStatus } from '@algreen/shared-types';
import type { BlockRequestDto } from '@algreen/shared-types';
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

export function BlockRequestsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>(undefined);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['block-requests', tenantId, statusFilter],
    queryFn: () => blockRequestsApi.getAll(tenantId!, statusFilter).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      blockRequestsApi.approve(id, { handledByUserId: userId!, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      message.success(t('blockRequests.approved'));
      setApproveTarget(null);
      setApproveNote('');
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('blockRequests.approveFailed'))),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      blockRequestsApi.reject(id, { handledByUserId: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      message.success(t('blockRequests.rejected'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('blockRequests.rejectFailed'))),
  });

  const columns = [
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      width: 110,
      filters: Object.values(RequestStatus).map((s) => ({ text: tEnum('RequestStatus', s), value: s })),
      filteredValue: statusFilter ? [statusFilter] : null,
      filterMultiple: false,
      render: (s: RequestStatus) => <StatusBadge status={s} />,
    },
    { title: t('blockRequests.note'), dataIndex: 'requestNote', ellipsis: true },
    {
      title: t('blockRequests.response'),
      key: 'response',
      ellipsis: true,
      render: (_: unknown, record: BlockRequestDto) => {
        if (record.status === RequestStatus.Approved && record.blockReason) {
          return <Typography.Text type="success">{record.blockReason}</Typography.Text>;
        }
        if (record.status === RequestStatus.Rejected && record.rejectionNote) {
          return <Typography.Text type="danger">{record.rejectionNote}</Typography.Text>;
        }
        return '—';
      },
    },
    {
      title: t('common:labels.created'),
      dataIndex: 'createdAt',
      width: 150,
      sorter: (a: BlockRequestDto, b: BlockRequestDto) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend' as const,
      render: (d: string) => dayjs(d).format('DD.MM.YYYY. HH:mm'),
    },
    {
      title: t('common:labels.actions'),
      width: 180,
      render: (_: unknown, record: BlockRequestDto) => {
        if (record.status === RequestStatus.Pending) {
          return (
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => setApproveTarget(record.id)}
              >
                {t('common:actions.approve')}
              </Button>
              <Popconfirm
                title={t('blockRequests.rejectConfirm')}
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
      <Title level={4} style={{ marginBottom: 16 }}>{t('blockRequests.title')}</Title>
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

      <Modal
        title={t('blockRequests.approveTitle')}
        open={!!approveTarget}
        onCancel={() => { setApproveTarget(null); setApproveNote(''); }}
        onOk={() => {
          if (!approveNote.trim()) {
            message.warning(t('blockRequests.blockReasonRequired'));
            return;
          }
          approveMutation.mutate({ id: approveTarget!, note: approveNote });
        }}
        okText={t('common:actions.approve')}
        cancelText={t('common:actions.cancel')}
        confirmLoading={approveMutation.isPending}
      >
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t('blockRequests.blockReason')}</label>
          <Input.TextArea
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            rows={3}
            placeholder={t('blockRequests.blockReason')}
          />
        </div>
      </Modal>
    </div>
  );
}
