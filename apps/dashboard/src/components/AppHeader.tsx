import { Layout, Space, Button, Dropdown, Typography } from 'antd';
import { LogoutOutlined, UserOutlined, GlobalOutlined } from '@ant-design/icons';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';
import { NotificationBell } from './NotificationBell';

const { Header } = Layout;
const { Text } = Typography;

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, i18n } = useTranslation('dashboard');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Space size="middle">
        <Dropdown
          menu={{
            items: [
              {
                key: 'sr',
                label: t('language.sr'),
                onClick: () => changeLanguage('sr'),
              },
              {
                key: 'en',
                label: t('language.en'),
                onClick: () => changeLanguage('en'),
              },
            ],
            selectedKeys: [i18n.language],
          }}
          trigger={['click']}
        >
          <Button icon={<GlobalOutlined />}>
            {i18n.language === 'sr' ? 'SR' : 'EN'}
          </Button>
        </Dropdown>
        <NotificationBell />
        <Dropdown
          menu={{
            items: [
              {
                key: 'user',
                label: (
                  <Space direction="vertical" size={0}>
                    <Text strong>{user?.fullName}</Text>
                    <Text type="secondary">{user?.role}</Text>
                  </Space>
                ),
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: t('common:actions.logout'),
                danger: true,
                onClick: logout,
              },
            ],
          }}
          trigger={['click']}
        >
          <Button icon={<UserOutlined />} shape="circle" />
        </Dropdown>
      </Space>
    </Header>
  );
}
