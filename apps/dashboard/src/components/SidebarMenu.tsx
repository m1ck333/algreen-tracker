import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Badge } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  StopOutlined,
  SwapOutlined,
  UserOutlined,
  SettingOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  TagOutlined,
  ProfileOutlined,
  BankOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  InboxOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  HistoryOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthStore } from '@alblue/auth';
import { UserRole, RequestStatus, TenantFeature, hasRole } from '@alblue/shared-types';
import { blockRequestsApi } from '@alblue/api-client';
import { useTranslation } from '@alblue/i18n';
import { useSignalREvent, SignalREvents } from '@alblue/signalr-client';
import { useTenantFeatures } from '../hooks/useTenantFeatures';

interface SidebarMenuProps {
  collapsed: boolean;
}

export function SidebarMenu({ collapsed: _collapsed }: SidebarMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.tenantId);
  const role = user?.role;
  const { t } = useTranslation('dashboard');

  const isCoordOrAbove =
    role === UserRole.Coordinator || role === UserRole.Manager || role === UserRole.Admin || role === UserRole.SuperAdmin;
  const isAdminOrManager = role === UserRole.Admin || role === UserRole.Manager || role === UserRole.SuperAdmin;
  const isSales = role === UserRole.SalesManager;
  // Magacin gating — Saša 08.06.2026: read access (Stanje/Istorija) for
  // management AND Magacioner role; write access (Ulaz/Izlaz/Materijali)
  // for management + Magacioner. Magacioner can be either the primary role
  // or an additional role on a user with another primary (e.g. Coordinator
  // + Magacioner).
  const isMagacionerOrAdmin = isAdminOrManager || hasRole(user, UserRole.Magacioner);
  const canReadMagacin = isCoordOrAbove || hasRole(user, UserRole.Magacioner);

  // Saša 17.06.2026: per-tenant feature gating. Process times + Magacin
  // are opt-in on the Basic plan; SAs flip them per tenant via Firme.
  const { isEnabled } = useTenantFeatures();
  const processTimesEnabled = isEnabled(TenantFeature.ProcessTimes);
  const magacinEnabled = isEnabled(TenantFeature.Magacin);

  const queryClient = useQueryClient();
  const { data: pendingBlockCount } = useQuery({
    queryKey: ['block-requests-pending-count', tenantId],
    queryFn: () =>
      blockRequestsApi
        .getAll({ status: RequestStatus.Pending, page: 1, pageSize: 1 })
        .then((r) => r.data.totalCount),
    enabled: !!tenantId && isCoordOrAbove,
    // SignalR refreshes this within a second of the BE state changing
    // (see below). Polling is the safety net for missed events.
    refetchInterval: 60_000,
  });

  const invalidatePendingBlockCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['block-requests-pending-count'] });
  }, [queryClient]);
  // NotificationCreated covers Block Created/Approved/Rejected — including
  // Rejected which never had its own SignalR event. Other notification types
  // (low-stock, deadline, ...) also trigger an invalidate; harmless, the
  // refetch is a 1-row count query.
  useSignalREvent(SignalREvents.NotificationCreated, invalidatePendingBlockCount);

  const items = [
    isCoordOrAbove && {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('nav.dashboard'),
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: t('nav.orders'),
    },
    isSales && {
      key: '/sales',
      icon: <DollarOutlined />,
      label: t('nav.sales'),
    },
    isCoordOrAbove && {
      key: '/block-requests',
      icon: (pendingBlockCount ?? 0) > 0
        ? <Badge count={pendingBlockCount} size="small" />
        : <StopOutlined />,
      label: t('nav.blockRequests'),
    },
    isCoordOrAbove && {
      key: '/change-requests',
      icon: <SwapOutlined />,
      label: t('nav.changeRequests'),
    },
    isCoordOrAbove && processTimesEnabled && {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: t('nav.reports'),
    },
    canReadMagacin && magacinEnabled && {
      key: 'warehouse',
      icon: <InboxOutlined />,
      label: t('nav.warehouse'),
      children: [
        { key: '/warehouse/stock', icon: <DatabaseOutlined />, label: t('nav.stock') },
        isMagacionerOrAdmin && { key: '/warehouse/inflow', icon: <ImportOutlined />, label: t('nav.inflow') },
        isMagacionerOrAdmin && { key: '/warehouse/outflow', icon: <ExportOutlined />, label: t('nav.outflow') },
        { key: '/warehouse/history', icon: <HistoryOutlined />, label: t('nav.history') },
      ].filter(Boolean),
    },
    isAdminOrManager && {
      key: 'admin',
      icon: <SettingOutlined />,
      label: t('nav.admin'),
      children: [
        { key: '/admin/users', icon: <UserOutlined />, label: t('nav.users') },
        { key: '/admin/processes', icon: <ApartmentOutlined />, label: t('nav.processes') },
        { key: '/admin/product-categories', icon: <AppstoreOutlined />, label: t('nav.categories') },
        { key: '/admin/order-types', icon: <ProfileOutlined />, label: t('nav.orderTypes') },
        { key: '/admin/special-request-types', icon: <TagOutlined />, label: t('nav.specialRequests') },
        magacinEnabled && { key: '/admin/materials', icon: <BlockOutlined />, label: t('nav.materials') },
        {
          key: '/admin/company',
          icon: <BankOutlined />,
          label: t('nav.firma'),
        },
        { key: '/admin/shifts', icon: <ClockCircleOutlined />, label: t('nav.shifts') },
      ].filter(Boolean),
    },
  ].filter(Boolean) as Parameters<typeof Menu>[0]['items'];

  const selectedKey = location.pathname;

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      defaultOpenKeys={selectedKey.startsWith('/admin') ? ['admin'] : []}
      onClick={({ key }) => {
        if (key !== 'admin') navigate(key);
      }}
      items={items}
    />
  );
}
