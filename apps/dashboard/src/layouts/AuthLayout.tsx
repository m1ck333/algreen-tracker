import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';

export function AuthLayout() {
  return (
    <Layout
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Outlet />
    </Layout>
  );
}
