import { useState, useCallback } from 'react';
import { Badge, Button, Popover, List, Typography, Space, Empty, Tooltip, Divider, Segmented, theme } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClearOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';
import type { NotificationDto } from '@algreen/shared-types';

const { Text } = Typography;
const PAGE_SIZE = 15;

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface SidebarFooterProps {
  collapsed: boolean;
}

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, i18n } = useTranslation('dashboard');
  const queryClient = useQueryClient();
  const { token } = theme.useToken();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: count } = useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount(userId!).then((r) => r.data),
    enabled: !!userId,
    refetchInterval: 120_000,
  });

  const { data: pagedResult, isLoading } = useQuery({
    queryKey: ['notifications', 'list', userId, page],
    queryFn: () => notificationsApi.getAll({ userId: userId!, page, pageSize: PAGE_SIZE }).then((r) => r.data),
    enabled: !!userId && notifOpen,
  });

  const notifications = pagedResult?.items ?? [];
  const hasMore = pagedResult ? page * PAGE_SIZE < pagedResult.totalCount : false;

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: invalidateAll,
  });
  const markAsUnread = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsUnread(id),
    onSuccess: invalidateAll,
  });
  const markAllAsRead = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(userId!),
    onSuccess: invalidateAll,
  });
  const deleteOne = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: invalidateAll,
  });
  const deleteAll = useMutation({
    mutationFn: () => notificationsApi.deleteAll(userId!),
    onSuccess: () => {
      setPage(1);
      invalidateAll();
    },
  });

  const notificationsContent = (
    <div style={{ width: 360 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 15 }}>{t('notifications.title')}</Text>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {(count ?? 0) > 0 && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => markAllAsRead.mutate()}
              loading={markAllAsRead.isPending}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              type="link"
              size="small"
              danger
              icon={<ClearOutlined />}
              onClick={() => deleteAll.mutate()}
              loading={deleteAll.isPending}
            >
              {t('notifications.clearAll')}
            </Button>
          )}
        </div>
      </div>
      <List
        loading={isLoading}
        dataSource={notifications}
        locale={{ emptyText: <Empty description={t('notifications.noNotifications')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        size="small"
        style={{ maxHeight: 400, overflowY: 'auto' }}
        loadMore={hasMore ? (
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <Button size="small" onClick={() => setPage((p) => p + 1)}>
              {t('notifications.loadMore')}
            </Button>
          </div>
        ) : null}
        renderItem={(item: NotificationDto) => (
          <List.Item
            style={{
              background: item.isRead ? undefined : token.colorPrimaryBg,
              padding: '8px 12px',
            }}
            actions={[
              item.isRead ? (
                <Tooltip key="unread" title={t('notifications.markUnread')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeInvisibleOutlined />}
                    onClick={() => markAsUnread.mutate(item.id)}
                  />
                </Tooltip>
              ) : (
                <Tooltip key="read" title={t('notifications.markAllRead')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => markAsRead.mutate(item.id)}
                  />
                </Tooltip>
              ),
              <Tooltip key="delete" title={t('notifications.delete')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => deleteOne.mutate(item.id)}
                />
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              title={<Text strong={!item.isRead} style={{ fontSize: 13 }}>{item.title}</Text>}
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('notifications.timeAgo', { time: formatTimeAgo(item.createdAt) })}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const profileContent = (
    <div style={{ width: 240 }}>
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Text strong>{user?.fullName}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{user?.role}</Text>
      </Space>
      <Divider style={{ margin: '12px 0' }} />
      <div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          <GlobalOutlined /> {t('profile.language', { defaultValue: 'Language' })}
        </Text>
        <Segmented
          block
          value={i18n.language === 'en' ? 'en' : 'sr'}
          onChange={(v) => i18n.changeLanguage(v as string)}
          options={[
            { label: t('language.sr'), value: 'sr' },
            { label: t('language.en'), value: 'en' },
          ]}
        />
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <Button
        block
        danger
        icon={<LogoutOutlined />}
        onClick={() => { setProfileOpen(false); logout(); }}
      >
        {t('common:actions.logout')}
      </Button>
    </div>
  );

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    height: 44,
    padding: collapsed ? '0' : '0 24px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer',
    fontSize: 14,
    transition: 'background 0.2s',
  };

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4, paddingBottom: 4 }}>
      <Popover
        content={notificationsContent}
        trigger="click"
        open={notifOpen}
        onOpenChange={(v) => { setNotifOpen(v); if (v) setPage(1); }}
        placement="rightBottom"
        arrow={false}
      >
        <Tooltip title={collapsed ? t('nav.notifications', { defaultValue: 'Notifications' }) : ''} placement="right">
          <div
            style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Badge count={count ?? 0} size="small" offset={[2, -2]}>
              <BellOutlined style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }} />
            </Badge>
            {!collapsed && <span>{t('nav.notifications', { defaultValue: 'Notifications' })}</span>}
          </div>
        </Tooltip>
      </Popover>
      <Popover
        content={profileContent}
        trigger="click"
        open={profileOpen}
        onOpenChange={setProfileOpen}
        placement="rightBottom"
        arrow={false}
      >
        <Tooltip title={collapsed ? user?.fullName ?? t('nav.profile', { defaultValue: 'Profile' }) : ''} placement="right">
          <div
            style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <UserOutlined style={{ fontSize: 16 }} />
            {!collapsed && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName ?? t('nav.profile', { defaultValue: 'Profile' })}
              </span>
            )}
          </div>
        </Tooltip>
      </Popover>
    </div>
  );
}
