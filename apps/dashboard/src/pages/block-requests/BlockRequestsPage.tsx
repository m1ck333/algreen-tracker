import { useState, useEffect } from 'react';
import { useTableHeight } from '../../hooks/useTableHeight';
import { Typography, Table, Space, Button, App, Popconfirm, Modal, Input, Select, DatePicker, Dropdown, theme } from 'antd';
import { useNavigate } from 'react-router-dom';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blockRequestsApi, processWorkflowApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { RequestStatus, ProcessStatus } from '@algreen/shared-types';
import type { BlockRequestDto } from '@algreen/shared-types';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

function getApiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function getTranslatedError(error: unknown, t: (key: string, opts?: Record<string, string>) => string, fallback: string): string {
  const resp = (error as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
  if (resp?.code) {
    const translated = t(`common:errors.${resp.code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return resp?.message || fallback;
}

export function BlockRequestsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const userId = useAuthStore((s) => s.user?.id);
  const { token } = theme.useToken();
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>('createdAt');
  const [sortDirection, setSortDirection] = useState<string | undefined>('desc');
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();
  const navigate = useNavigate();

  const { ref: tableWrapperRef, height: tableBodyHeight } = useTableHeight();

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['block-requests', tenantId, statusFilter, debouncedSearch, dateFrom?.format('YYYY-MM-DD'), dateTo?.format('YYYY-MM-DD'), page, pageSize, sortBy, sortDirection],
    queryFn: () => blockRequestsApi.getAll({
      tenantId: tenantId!,
      status: statusFilter,
      search: debouncedSearch || undefined,
      createdFrom: dateFrom?.format('YYYY-MM-DD'),
      createdTo: dateTo?.format('YYYY-MM-DD'),
      page,
      pageSize,
      sortBy,
      sortDirection,
    }).then((r) => r.data),
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      blockRequestsApi.approve(id, { handledByUserId: userId!, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
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
      queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
      message.success(t('blockRequests.rejected'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('blockRequests.rejectFailed'))),
  });

  const unblockMutation = useMutation({
    mutationFn: ({ orderItemProcessId, resetTime }: { orderItemProcessId: string; resetTime: boolean }) =>
      processWorkflowApi.unblock(orderItemProcessId, { userId: userId!, resetTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['block-requests'] });
      queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['orders-master-view'] });
      message.success(t('blockRequests.unblocked'));
    },
    onError: (err) => message.error(getTranslatedError(err, t, t('blockRequests.unblockFailed'))),
  });

  const columns = [
    {
      title: t('common:labels.status'),
      dataIndex: 'status',
      width: 110,
      render: (s: RequestStatus) => <StatusBadge status={s} />,
    },
    {
      title: t('common:labels.orderNumber'),
      dataIndex: 'orderNumber',
      width: 140,
      render: (orderNumber: string | null, record: BlockRequestDto) =>
        orderNumber && record.orderId ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); navigate(`/orders?detail=${record.orderId}`); }}>
            {orderNumber}
          </Button>
        ) : '—',
    },
    {
      title: t('blockRequests.process'),
      dataIndex: 'processName',
      width: 140,
      render: (name: string | null) => name ?? '—',
    },
    {
      title: t('blockRequests.requestNote'),
      dataIndex: 'requestNote',
      ellipsis: true,
      sorter: true,
      sortOrder: sortBy === 'requestNote' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
    },
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
      sorter: true,
      sortOrder: sortBy === 'createdAt' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
      render: (d: string) => (<div><div>{dayjs(d).format('DD.MM.YYYY.')}</div><div style={{ fontSize: 11, color: token.colorTextSecondary }}>{dayjs(d).format('HH:mm')}</div></div>),
    },
    {
      title: t('common:labels.handledAt'),
      dataIndex: 'updatedAt',
      width: 150,
      render: (d: string | null) => d ? (<div><div>{dayjs(d).format('DD.MM.YYYY.')}</div><div style={{ fontSize: 11, color: token.colorTextSecondary }}>{dayjs(d).format('HH:mm')}</div></div>) : '—',
      sorter: true,
      sortOrder: sortBy === 'updatedAt' ? (sortDirection === 'desc' ? ('descend' as const) : ('ascend' as const)) : null,
    },
    {
      title: t('common:labels.actions'),
      width: 180,
      render: (_: unknown, record: BlockRequestDto) => {
        if (record.status === RequestStatus.Pending) {
          // Don't show if process is already blocked
          if (record.currentProcessStatus === ProcessStatus.Blocked) return null;
          // Show only on the most recent pending block for this process
          const allPendingForProcess = (pagedResult?.items ?? []).filter(
            (br) => br.status === RequestStatus.Pending && br.orderItemProcessId === record.orderItemProcessId
          );
          const isLatestPending = allPendingForProcess.length === 0 ||
            new Date(record.createdAt).getTime() >= Math.max(...allPendingForProcess.map((br) => new Date(br.createdAt).getTime()));
          if (!isLatestPending) return null;
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
        if (record.status === RequestStatus.Approved && record.orderItemProcessId && record.currentProcessStatus === ProcessStatus.Blocked) {
          // Show unblock only on the most recent approved block for this process
          const allApprovedForProcess = (pagedResult?.items ?? []).filter(
            (br) => br.status === RequestStatus.Approved && br.orderItemProcessId === record.orderItemProcessId
          );
          const isLatest = allApprovedForProcess.length === 0 || allApprovedForProcess[0]?.id === record.id ||
            new Date(record.createdAt).getTime() >= Math.max(...allApprovedForProcess.map((br) => new Date(br.createdAt).getTime()));
          if (!isLatest) return null;
          return (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'keep', label: t('blockRequests.unblockKeepTime'), onClick: () => unblockMutation.mutate({ orderItemProcessId: record.orderItemProcessId!, resetTime: false }) },
                  { key: 'reset', label: t('blockRequests.unblockResetTime'), onClick: () => unblockMutation.mutate({ orderItemProcessId: record.orderItemProcessId!, resetTime: true }) },
                ],
              }}
            >
              <Button type="primary" size="small" loading={unblockMutation.isPending}>
                {t('blockRequests.unblock')}
              </Button>
            </Dropdown>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Title level={4} style={{ marginBottom: 16 }}>{t('blockRequests.title')}</Title>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input.Search
          placeholder={t('common:actions.search')}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <Select
          placeholder={t('common:labels.status')}
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 160 }}
          options={Object.values(RequestStatus).map((s) => ({ label: tEnum('RequestStatus', s), value: s }))}
        />
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateFrom')}
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          format="DD.MM.YYYY"
          allowClear
          placeholder={t('common:labels.dateTo')}
        />
      </div>

      <div ref={tableWrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Table
          columns={columns}
          dataSource={pagedResult?.items}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 'max-content', y: tableBodyHeight }}
          pagination={{
            current: page,
            pageSize,
            total: pagedResult?.totalCount,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter) => {
            if (pagination.pageSize !== pageSize) {
              setPageSize(pagination.pageSize ?? 20);
              setPage(1);
              return;
            }
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            const newField = (s?.order ? (s.field as string) : undefined) ?? 'createdAt';
            const newDir = (s?.order === 'descend' ? 'desc' : s?.order === 'ascend' ? 'asc' : undefined) ?? 'desc';
            if (newField !== sortBy || newDir !== sortDirection) {
              setSortBy(newField);
              setSortDirection(newDir);
              setPage(1);
              return;
            }
            if (pagination.current !== page) setPage(pagination.current ?? 1);
          }}
        />
      </div>

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
