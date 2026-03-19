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
  BankOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@algreen/auth';
import { UserRole, RequestStatus } from '@algreen/shared-types';
import { blockRequestsApi } from '@algreen/api-client';
import { useTranslation } from '@algreen/i18n';

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
    role === UserRole.Coordinator || role === UserRole.Manager || role === UserRole.Admin;
  const isAdminOrManager = role === UserRole.Admin || role === UserRole.Manager;
  const isSales = role === UserRole.SalesManager;

  const { data: pendingBlockCount } = useQuery({
    queryKey: ['block-requests-pending-count', tenantId],
    queryFn: () =>
      blockRequestsApi
        .getAll({ tenantId: tenantId!, status: RequestStatus.Pending, page: 1, pageSize: 1 })
        .then((r) => r.data.totalCount),
    enabled: !!tenantId && isCoordOrAbove,
    refetchInterval: 30_000,
  });

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
      icon: (
        <Badge count={pendingBlockCount ?? 0} size="small" offset={[6, -4]}>
          <StopOutlined style={{ color: 'inherit', fontSize: 'inherit' }} />
        </Badge>
      ),
      label: t('nav.blockRequests'),
    },
    isCoordOrAbove && {
      key: '/change-requests',
      icon: <SwapOutlined />,
      label: t('nav.changeRequests'),
    },
    isAdminOrManager && {
      key: 'admin',
      icon: <SettingOutlined />,
      label: t('nav.admin'),
      children: [
        { key: '/admin/users', icon: <UserOutlined />, label: t('nav.users') },
        { key: '/admin/processes', icon: <ApartmentOutlined />, label: t('nav.processes') },
        { key: '/admin/product-categories', icon: <AppstoreOutlined />, label: t('nav.categories') },
        { key: '/admin/special-request-types', icon: <TagOutlined />, label: t('nav.specialRequests') },
        role === UserRole.Admin && {
          key: '/admin/tenants',
          icon: <BankOutlined />,
          label: t('nav.tenants'),
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
