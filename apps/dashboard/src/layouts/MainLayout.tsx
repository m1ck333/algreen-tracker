import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout, theme } from 'antd';
import { useAuthStore } from '@algreen/auth';
import {
  createConnection,
  startConnection,
  joinTenantGroup,
} from '@algreen/signalr-client';
import { tokenManager } from '@algreen/api-client';
import { SidebarMenu } from '../components/SidebarMenu';
import { SidebarFooter } from '../components/SidebarFooter';
import { ConnectionAlert } from '../components/ConnectionAlert';
import { useSignalRQueryInvalidation } from '../hooks/useSignalRQueryInvalidation';
import { useLayoutStore } from '../stores/layout-store';

const { Sider, Content } = Layout;

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const tenantId = useAuthStore((s) => s.tenantId);
  const { token: themeToken } = theme.useToken();
  const fullscreen = useLayoutStore((s) => s.fullscreen);

  useSignalRQueryInvalidation();

  useEffect(() => {
    const jwt = tokenManager.getToken();
    if (!jwt || !tenantId) return;

    let cancelled = false;

    createConnection(jwt);
    startConnection()
      .then(() => {
        if (!cancelled) return joinTenantGroup(tenantId);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {!fullscreen && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          theme="dark"
          style={{ height: '100vh', position: 'sticky', top: 0, left: 0 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
            <div
              style={{
                height: 48,
                margin: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={collapsed ? '/algreen-logo.png' : '/algreen-logo-text.png'}
                alt="Algreen"
                style={{ height: collapsed ? 32 : 28, objectFit: 'contain' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <SidebarMenu collapsed={collapsed} />
            </div>
            <SidebarFooter collapsed={collapsed} />
          </div>
        </Sider>
      )}
      <Layout style={{ overflow: 'hidden' }}>
        <Content
          style={{
            margin: fullscreen ? 0 : 24,
            padding: fullscreen ? 12 : 24,
            background: themeToken.colorBgContainer,
            borderRadius: fullscreen ? 0 : themeToken.borderRadius,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          {!fullscreen && <ConnectionAlert />}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
