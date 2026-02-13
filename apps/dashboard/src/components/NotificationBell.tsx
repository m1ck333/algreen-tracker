import { Badge, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';

export function NotificationBell() {
  const userId = useAuthStore((s) => s.user?.id);

  const { data: count } = useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount(userId!).then((r) => r.data),
    enabled: !!userId,
    refetchInterval: 120_000,
  });

  return (
    <Badge count={count ?? 0} size="small">
      <Button icon={<BellOutlined />} shape="circle" />
    </Badge>
  );
}
