import { useState, useCallback } from 'react';
import { Badge, Button, Popover, List, Menu, Typography, Space, Empty, Tooltip, Divider, Segmented, theme, Grid, Drawer, Form, Input, App } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  SunOutlined,
  MoonOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClearOutlined,
  EyeInvisibleOutlined,
  InfoCircleOutlined,
  BookOutlined,
  HistoryOutlined,
  LockOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, usersApi } from '@alblue/api-client';
import { useAuthStore } from '@alblue/auth';
import { useTranslation, useEnumTranslation } from '@alblue/i18n';
import type { NotificationDto } from '@alblue/shared-types';
import { NotificationType } from '@alblue/shared-types';
import { useSignalREvent, SignalREvents } from '@alblue/signalr-client';
import { useThemeStore } from '../stores/theme-store';
import { passwordRules } from '../utils/password';
import { getTranslatedError } from '../utils/errors';

const { Text } = Typography;
const PAGE_SIZE = 15;

/**
 * Map BE notification types to FE i18n template paths. If the type has a
 * template AND the notification carries structured params, render via i18n
 * (so it follows the active locale). Otherwise we fall back to the
 * BE-provided title/message (legacy / unmapped types).
 *
 * Some templates use i18next's `context` mechanism to switch sub-variants
 * (e.g. blockRequestRejected.message vs .message_withNote, or
 * orderActivated.title vs .title_readyForQueue). The BE sets a `context`
 * field inside paramsJson; i18next picks it up automatically from the
 * params object passed to `t()`.
 */
const NOTIFICATION_TEMPLATE_KEY: Partial<Record<NotificationType, string>> = {
  [NotificationType.MaterialLowStock]: 'notifications.templates.materialLowStock',
  [NotificationType.OrderActivated]: 'notifications.templates.orderActivated',
  [NotificationType.ProcessCompleted]: 'notifications.templates.processCompleted',
  [NotificationType.ProcessBlocked]: 'notifications.templates.processBlocked',
  [NotificationType.BlockRequest]: 'notifications.templates.blockRequest',
  [NotificationType.BlockRequestApproved]: 'notifications.templates.blockRequestApproved',
  [NotificationType.BlockRequestRejected]: 'notifications.templates.blockRequestRejected',
  [NotificationType.WorkerAutoLoggedOut]: 'notifications.templates.workerAutoLoggedOut',
  [NotificationType.DeadlineWarning]: 'notifications.templates.deadlineWarning',
  [NotificationType.DeadlineCritical]: 'notifications.templates.deadlineCritical',
  [NotificationType.ChangeRequest]: 'notifications.templates.changeRequest',
  [NotificationType.ChangeRequestApproved]: 'notifications.templates.changeRequestApproved',
  [NotificationType.ChangeRequestRejected]: 'notifications.templates.changeRequestRejected',
  [NotificationType.SubscriptionExpiring]: 'notifications.templates.subscriptionExpiring',
  [NotificationType.SubscriptionExpired]: 'notifications.templates.subscriptionExpired',
};

/**
 * Visual signal per notification type — a small leading icon in the bell
 * list so the user can scan by category without reading every title.
 * The colour is the antd token (resolved at render time via theme.useToken).
 */
type NotificationIconSpec = { icon: typeof BellOutlined; colorToken: 'colorError' | 'colorWarning' | 'colorPrimary' | 'colorSuccess' | 'colorTextSecondary' };
const NOTIFICATION_ICON: Partial<Record<NotificationType, NotificationIconSpec>> = {
  [NotificationType.MaterialLowStock]: { icon: AlertOutlined, colorToken: 'colorError' },
  [NotificationType.DeadlineCritical]: { icon: ClockCircleOutlined, colorToken: 'colorError' },
  [NotificationType.DeadlineWarning]: { icon: ClockCircleOutlined, colorToken: 'colorWarning' },
  [NotificationType.BlockRequest]: { icon: StopOutlined, colorToken: 'colorWarning' },
  [NotificationType.BlockRequestApproved]: { icon: CheckCircleOutlined, colorToken: 'colorSuccess' },
  [NotificationType.BlockRequestRejected]: { icon: CloseCircleOutlined, colorToken: 'colorError' },
  [NotificationType.ProcessCompleted]: { icon: CheckCircleOutlined, colorToken: 'colorSuccess' },
  [NotificationType.ProcessBlocked]: { icon: WarningOutlined, colorToken: 'colorWarning' },
  [NotificationType.OrderActivated]: { icon: PlayCircleOutlined, colorToken: 'colorPrimary' },
  [NotificationType.WorkerAutoLoggedOut]: { icon: LogoutOutlined, colorToken: 'colorWarning' },
  [NotificationType.ChangeRequest]: { icon: EditOutlined, colorToken: 'colorWarning' },
  [NotificationType.ChangeRequestApproved]: { icon: CheckCircleOutlined, colorToken: 'colorSuccess' },
  [NotificationType.ChangeRequestRejected]: { icon: CloseCircleOutlined, colorToken: 'colorError' },
  [NotificationType.SubscriptionExpiring]: { icon: ClockCircleOutlined, colorToken: 'colorWarning' },
  [NotificationType.SubscriptionExpired]: { icon: ClockCircleOutlined, colorToken: 'colorError' },
};


function renderNotificationText(
  n: NotificationDto,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { title: string; message: string } {
  const templatePath = NOTIFICATION_TEMPLATE_KEY[n.type];
  if (templatePath && n.paramsJson) {
    try {
      const params = JSON.parse(n.paramsJson) as Record<string, unknown>;
      return {
        title: t(`${templatePath}.title`, params),
        message: t(`${templatePath}.message`, params),
      };
    } catch {
      // Bad JSON — fall through to BE strings rather than crashing.
    }
  }
  return { title: n.title, message: n.message };
}

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
  /** Called when an in-popover action opens its own overlay (Drawer / Modal)
   *  — used by MainLayout to dismiss the mobile sidebar Drawer so it doesn't
   *  sit visible behind the new overlay. No-op on desktop. */
  onOverlayAction?: () => void;
}

export function SidebarFooter({ collapsed, onOverlayAction }: SidebarFooterProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, i18n } = useTranslation('dashboard');
  const { tEnum } = useEnumTranslation();
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false;
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [pwForm] = Form.useForm();
  const { message } = App.useApp();

  // Self-service password change (Milos 16.06.2026). Strictly self-only on
  // the BE — even SuperAdmin can't change another user's password through
  // this endpoint. Admin-initiated reset is /reset-password (separate UI).
  const changePasswordMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      usersApi.changePassword(user!.id, values),
    onSuccess: () => {
      message.success(t('profile.passwordChanged'));
      setChangePwOpen(false);
      pwForm.resetFields();
    },
    onError: (err) => message.error(getTranslatedError(err, t,
      t('profile.passwordChangeFailed'))),
  });

  // Info group rendered as a real antd Menu so the flyout (collapsed) and
  // inline-expansion (expanded) behaviour matches every other parent item
  // in SidebarMenu — Milos 08.06.2026 asked for the footer to use the same
  // UI as the upper part instead of the custom Popover+Tooltip it had.
  const infoMenuItems = [
    {
      key: 'info',
      icon: <InfoCircleOutlined />,
      label: t('nav.info'),
      children: [
        { key: '/tutorial', icon: <BookOutlined />, label: t('nav.tutorial') },
        { key: '/whats-new', icon: <HistoryOutlined />, label: t('nav.whatsNew') },
      ],
    },
  ];

  const { data: count } = useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount(userId!).then((r) => r.data),
    enabled: !!userId,
    // Polling fallback. The SignalR subscriptions below make most updates
    // arrive instantly, but polling still catches the types we don't have
    // a dedicated SignalR event for (e.g. MaterialLowStock fires from a
    // stock-entry write — no broadcast event for that yet).
    refetchInterval: 60_000,
  });

  // SignalR push: NotificationCreated fires every time the BE persists a new
  // in-app notification for anyone in this tenant (block request, low-stock
  // alarm, deadline warning, auto-logout, ...). One subscription covers every
  // notification type — no per-type wiring on the FE.
  const invalidateNotificationsLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);
  useSignalREvent(SignalREvents.NotificationCreated, invalidateNotificationsLists);

  /**
   * Click navigation for a notification. Each notification carries a
   * referenceType + referenceId that maps to the page where the user can
   * act on the underlying record. If the type maps cleanly, we mark as
   * read and navigate; otherwise we just mark as read (no navigation).
   * Drops the bell popover/drawer on the way out.
   */
  function handleNotificationClick(item: NotificationDto) {
    if (!item.isRead) markAsRead.mutate(item.id);
    setNotifOpen(false);

    const refType = item.referenceType;
    const refId = item.referenceId;
    if (!refType) return;

    switch (refType) {
      case 'Order':
        if (refId) navigate(`/orders?detail=${refId}`);
        else navigate('/orders');
        break;
      case 'BlockRequest':
        navigate('/block-requests');
        break;
      case 'ChangeRequest':
        navigate('/change-requests');
        break;
      case 'Material':
        // The low-stock notification lands the user on the Stock page
        // filtered to materials currently below min — the actionable view.
        navigate('/warehouse/stock?status=BelowMin');
        break;
      case 'WorkSession':
        navigate('/dashboard');
        break;
      case 'Subscription':
        // Saša 18.06.2026: lands the Admin on Profil firme with the
        // Naplata tab pre-selected (TenantProfilePage reads ?tab=billing).
        navigate('/admin/company?tab=billing');
        break;
      default:
        break;
    }
  }

  // Saša 19.06.2026: switched from page-keyed useQuery to useInfiniteQuery
  // so "Load more" ACCUMULATES instead of replacing the visible page.
  // Old behaviour wiped the list back to page N's 15 items, which made
  // it impossible to scroll back up to earlier items the user had
  // already seen.
  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'list', userId],
    queryFn: ({ pageParam }) =>
      notificationsApi.getAll({ userId: userId!, page: pageParam, pageSize: PAGE_SIZE }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.totalCount ? allPages.length + 1 : undefined;
    },
    enabled: !!userId && notifOpen,
  });

  const notifications = infiniteData?.pages.flatMap((p) => p.items) ?? [];
  const hasMore = !!hasNextPage;

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
    onSuccess: invalidateAll,
  });

  const notificationsContent = (
    <div style={{ width: isMobile ? '100%' : 360 }}>
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
            <Button size="small" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {t('notifications.loadMore')}
            </Button>
          </div>
        ) : null}
        renderItem={(item: NotificationDto) => {
          const { title, message } = renderNotificationText(item, t);
          const iconSpec = NOTIFICATION_ICON[item.type];
          const IconComp = iconSpec?.icon ?? BellOutlined;
          const iconColor = iconSpec ? token[iconSpec.colorToken] : token.colorTextSecondary;
          // Notifications with a referenceType are clickable — clicking
          // marks-as-read and jumps to the relevant page. Notifications
          // without a referenceType only show the cursor on hover for the
          // action buttons.
          const isClickable = !!item.referenceType;
          return (
          <List.Item
            className={isClickable ? 'notification-item-clickable' : undefined}
            style={{
              background: item.isRead ? undefined : token.colorPrimaryBg,
              padding: '10px 12px',
              cursor: isClickable ? 'pointer' : 'default',
              alignItems: 'flex-start',
            }}
            onClick={isClickable ? () => handleNotificationClick(item) : undefined}
            actions={[
              item.isRead ? (
                <Tooltip key="unread" title={t('notifications.markUnread')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeInvisibleOutlined />}
                    onClick={(e) => { e.stopPropagation(); markAsUnread.mutate(item.id); }}
                  />
                </Tooltip>
              ) : (
                <Tooltip key="read" title={t('notifications.markAllRead')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={(e) => { e.stopPropagation(); markAsRead.mutate(item.id); }}
                  />
                </Tooltip>
              ),
              <Tooltip key="delete" title={t('notifications.delete')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); deleteOne.mutate(item.id); }}
                />
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: iconColor + '22', color: iconColor, fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  <IconComp />
                </div>
              }
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <Text strong={!item.isRead} style={{ fontSize: 13, lineHeight: 1.3 }}>{title}</Text>
                  <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatTimeAgo(item.createdAt)}
                  </Text>
                </div>
              }
              description={
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>{message}</Text>
              }
            />
          </List.Item>
          );
        }}
      />
    </div>
  );

  const profileContent = (
    <div style={{ width: 240 }}>
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Text strong>{user?.fullName}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{user?.role ? tEnum('UserRole', user.role) : ''}</Text>
      </Space>
      <Divider style={{ margin: '12px 0' }} />
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('profile.theme')}
          </Text>
          <Segmented
            block
            value={themeMode}
            onChange={(v) => setThemeMode(v as 'light' | 'dark')}
            options={[
              { label: t('profile.themeLight'), value: 'light', icon: <SunOutlined /> },
              { label: t('profile.themeDark'), value: 'dark', icon: <MoonOutlined /> },
            ]}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            <GlobalOutlined /> {t('profile.language')}
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
      </Space>
      <Divider style={{ margin: '12px 0' }} />
      <Button
        block
        icon={<LockOutlined />}
        onClick={() => { setProfileOpen(false); onOverlayAction?.(); setChangePwOpen(true); }}
        style={{ marginBottom: 8 }}
      >
        {t('profile.changePassword')}
      </Button>
      <Button
        block
        danger
        icon={<LogoutOutlined />}
        onClick={() => { setProfileOpen(false); queryClient.clear(); logout(); }}
      >
        {t('common:actions.logout')}
      </Button>
    </div>
  );

  const changePasswordDrawer = (
    <Drawer
      open={changePwOpen}
      onClose={() => { setChangePwOpen(false); pwForm.resetFields(); }}
      title={t('profile.changePassword')}
      width={Math.min(480, window.innerWidth)}
      extra={
        <Button
          type="primary"
          onClick={() => pwForm.submit()}
          loading={changePasswordMutation.isPending}
        >
          {t('common:actions.save')}
        </Button>
      }
      destroyOnHidden
    >
      <Form
        form={pwForm}
        layout="vertical"
        onFinish={(values) => changePasswordMutation.mutate({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })}
      >
        <Form.Item
          name="currentPassword"
          label={t('profile.currentPassword')}
          rules={[{ required: true, message: t('profile.currentPasswordRequired') }]}
        >
          <Input.Password autoComplete="current-password" autoFocus />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t('profile.newPassword')}
          rules={passwordRules(t)}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t('profile.confirmPassword')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: t('profile.confirmPasswordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error(
                  t('profile.confirmPasswordMismatch')));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Drawer>
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
      {/* Info: same antd Menu component as SidebarMenu, so flyout (collapsed)
          and inline expansion (expanded) match the upper menu groups. Just
          this one group; Notifications + Profile below keep custom Popovers
          because their content (notif list with actions, theme/lang/logout)
          doesn't fit the antd submenu pattern. */}
      <Menu
        theme="dark"
        mode="inline"
        inlineCollapsed={collapsed}
        items={infoMenuItems}
        selectedKeys={[location.pathname]}
        onClick={({ key }) => {
          if (key.startsWith('/')) navigate(key);
        }}
        style={{ border: 'none', background: 'transparent' }}
      />
      {(() => {
        const bellRow = (
          <Tooltip title={collapsed ? t('nav.notifications') : ''} placement="right">
            <div
              style={rowStyle}
              onClick={isMobile ? () => setNotifOpen(true) : undefined}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Badge count={count ?? 0} size="small" offset={[2, -2]}>
                <BellOutlined style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }} />
              </Badge>
              {!collapsed && <span>{t('nav.notifications')}</span>}
            </div>
          </Tooltip>
        );

        // Mobile: the sidebar lives inside a Drawer already, so a
        // right-placed Popover anchored to the bell would land off-screen
        // (the bell is at ~x=200px and the popover would extend further
        // right). Use a dedicated right-side Drawer for notifications
        // instead; it stacks above the menu Drawer cleanly.
        if (isMobile) {
          return (
            <>
              {bellRow}
              <Drawer
                title={t('notifications.title')}
                placement="right"
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                width={Math.min(360, window.innerWidth - 16)}
                styles={{ body: { padding: 16 } }}
              >
                {notificationsContent}
              </Drawer>
            </>
          );
        }

        return (
          <Popover
            content={notificationsContent}
            trigger="click"
            open={notifOpen}
            onOpenChange={setNotifOpen}
            placement="rightBottom"
            arrow={false}
          >
            {bellRow}
          </Popover>
        );
      })()}
      <Popover
        content={profileContent}
        trigger="click"
        open={profileOpen}
        onOpenChange={setProfileOpen}
        placement="rightBottom"
        arrow={false}
      >
        <Tooltip title={collapsed ? user?.fullName ?? t('nav.profile') : ''} placement="right">
          <div
            style={rowStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <UserOutlined style={{ fontSize: 16 }} />
            {!collapsed && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName ?? t('nav.profile')}
              </span>
            )}
          </div>
        </Tooltip>
      </Popover>
      {changePasswordDrawer}
    </div>
  );
}
