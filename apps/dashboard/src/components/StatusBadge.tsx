import { Tag } from 'antd';
import { OrderStatus, ProcessStatus, RequestStatus } from '@algreen/shared-types';
import { useEnumTranslation } from '@algreen/i18n';

const orderStatusColors: Record<OrderStatus, string> = {
  [OrderStatus.Draft]: 'default',
  [OrderStatus.Active]: 'processing',
  [OrderStatus.Paused]: 'warning',
  [OrderStatus.Cancelled]: 'error',
  [OrderStatus.Completed]: 'success',
};

const processStatusColors: Record<ProcessStatus, string> = {
  [ProcessStatus.Pending]: 'default',
  [ProcessStatus.InProgress]: 'processing',
  [ProcessStatus.Completed]: 'success',
  [ProcessStatus.Blocked]: 'error',
  [ProcessStatus.Stopped]: 'warning',
  [ProcessStatus.Withdrawn]: 'default',
};

const requestStatusColors: Record<RequestStatus, string> = {
  [RequestStatus.Pending]: 'warning',
  [RequestStatus.Approved]: 'success',
  [RequestStatus.Rejected]: 'error',
};

interface StatusBadgeProps {
  status: OrderStatus | ProcessStatus | RequestStatus;
}

function getEnumName(status: string): string {
  if (Object.values(OrderStatus).includes(status as OrderStatus)) return 'OrderStatus';
  if (Object.values(ProcessStatus).includes(status as ProcessStatus)) return 'ProcessStatus';
  if (Object.values(RequestStatus).includes(status as RequestStatus)) return 'RequestStatus';
  return 'OrderStatus';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { tEnum } = useEnumTranslation();

  const color =
    (orderStatusColors as Record<string, string>)[status] ??
    (processStatusColors as Record<string, string>)[status] ??
    (requestStatusColors as Record<string, string>)[status] ??
    'default';

  return <Tag color={color}>{tEnum(getEnumName(status), status)}</Tag>;
}
