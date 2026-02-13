import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
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
import { useAuthStore } from '@algreen/auth';
import { UserRole } from '@algreen/shared-types';
import { useTranslation } from '@algreen/i18n';

interface SidebarMenuProps {
  collapsed: boolean;
}

export function SidebarMenu({ collapsed: _collapsed }: SidebarMenuProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const { t } = useTranslation('dashboard');

  const isCoordOrAbove =
    role === UserRole.Coordinator || role === UserRole.Manager || role === UserRole.Admin;
  const isAdminOrManager = role === UserRole.Admin || role === UserRole.Manager;
  const isSales = role === UserRole.SalesManager;

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
      icon: <StopOutlined />,
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
