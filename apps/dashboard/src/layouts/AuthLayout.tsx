import { Outlet } from 'react-router-dom';
import { Layout, theme } from 'antd';

export function AuthLayout() {
  const { token } = theme.useToken();
  return (
    <Layout
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.colorBgLayout,
      }}
    >
      <Outlet />
    </Layout>
  );
}
