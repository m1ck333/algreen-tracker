import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout, Spin, theme } from 'antd';
import { PublicLanguageSwitcher } from '../components/PublicLanguageSwitcher';

export function AuthLayout() {
  const { token } = theme.useToken();
  // Neutral wrapper — each page handles its own centering. LoginPage wraps
  // the Card in a centered flex container; AboutPage uses its own max-width
  // container with auto margins. This avoids the trade-off where vertical
  // centering clips long pages off the top.
  return (
    <Layout
      style={{
        minHeight: '100vh',
        background: token.colorBgLayout,
      }}
    >
      <PublicLanguageSwitcher />
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <Spin size="large" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </Layout>
  );
}
