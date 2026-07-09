import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Layout, theme, Grid, Button, Drawer, Spin } from 'antd';
import { MenuOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import {
  createConnection,
  startConnection,
  joinTenantGroup,
} from '@alblue/signalr-client';
import { tokenManager } from '@alblue/api-client';
import { SidebarMenu } from '../components/SidebarMenu';
import { SidebarFooter } from '../components/SidebarFooter';
import { ConnectionAlert } from '../components/ConnectionAlert';
import { useSignalRQueryInvalidation } from '../hooks/useSignalRQueryInvalidation';
import { useTenantLogo } from '../hooks/useTenantLogo';
import { useLayoutStore } from '../stores/layout-store';

const { Sider, Content } = Layout;

export function MainLayout() {
  const { t } = useTranslation('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const tenantId = useAuthStore((s) => s.tenantId);
  const { token: themeToken } = theme.useToken();
  const fullscreen = useLayoutStore((s) => s.fullscreen);
  const screens = Grid.useBreakpoint();
  // Mobile = anything below lg (antd lg is ≥ 992px). Below that, the Sider
  // hogs ~80px even collapsed; instead we hide it and offer a floating
  // hamburger button that opens a Drawer with the menu.
  const isMobile = screens.lg === false;
  const location = useLocation();
  const tenantLogoUrl = useTenantLogo();

  // Auto-close the mobile drawer whenever the route changes (clicking a
  // menu item navigates, so the user expects the menu to dismiss).
  useEffect(() => {
    if (mobileDrawerOpen) setMobileDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useSignalRQueryInvalidation();

  useEffect(() => {
    const jwt = tokenManager.getToken();
    if (!jwt || !tenantId) return;

    let cancelled = false;

    createConnection(jwt);
    startConnection()
      .then(() => {
        if (!cancelled) return joinTenantGroup();
      })
      .catch(() => {
        // SignalR connection failures are handled by the SignalR client's
        // own auto-retry + by ConnectionAlert (red banner when the API is
        // unreachable). Swallowing here keeps the console clean during
        // routine reconnect churn (e.g. dev server restarts, brief network
        // hiccups). Production telemetry happens via the SignalR client's
        // own logger, not this catch.
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Sidebar inner content (logo + menu + footer). Re-used both as the
  // Sider's children on desktop and as the Drawer's body on mobile.
  // Top row: tenant client logo, always centered (Saša 18.06.2026
  // unified mobile + desktop). Close / collapse action lives in the
  // bottom row's right corner on every breakpoint so the layout reads
  // the same.
  const sidebarBody = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          height: 72,
          margin: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Top of sidebar — Saša 14.06.2026 convention: this slot is the
            per-tenant CLIENT logo. When the tenant hasn't uploaded one yet
            (or while the blob is loading) we fall back to the MPMS mark so
            the layout never has an empty box. Bottom of sidebar always
            stays MPMS — that's the product brand, not the client's. */}
        <img
          src={tenantLogoUrl ?? (isMobile || !collapsed ? '/mpms-logo-text.png' : '/mpms-logo.png')}
          alt={tenantLogoUrl ? 'Logo' : 'MPMS'}
          style={{ height: isMobile || !collapsed ? 56 : 36, objectFit: 'contain' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <SidebarMenu collapsed={isMobile ? false : collapsed} />
      </div>
      <SidebarFooter
        collapsed={isMobile ? false : collapsed}
        onOverlayAction={() => setMobileDrawerOpen(false)}
      />
      {/* Bottom MPMS product mark. Per Saša 17.06.2026: same size as the
          top logo (56px) and horizontally centered. The close / collapse
          action sits in the right corner (position: absolute) so it
          doesn't push the logo off-center — the X close on mobile and
          the collapse chevron on desktop share this slot for visual
          consistency (Saša 18.06.2026).
          Collapsed rail: just the expand chevron, no logo (top of
          sidebar already carries the square MPMS mark in icon-rail mode). */}
      {isMobile ? (
        <div style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 72,
          margin: 16,
          flexShrink: 0,
        }}>
          <img src="/mpms-logo-text.png" alt="MPMS" style={{ height: 56, objectFit: 'contain' }} />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }} />}
            onClick={() => setMobileDrawerOpen(false)}
            aria-label={t('nav.aria.closeMenu')}
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      ) : collapsed ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px', flexShrink: 0 }}>
          <Button
            type="text"
            size="small"
            icon={<RightOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            onClick={() => setCollapsed(false)}
            aria-label={t('nav.aria.expandSidebar')}
          />
        </div>
      ) : (
        <div style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 72,
          margin: 16,
          flexShrink: 0,
        }}>
          <img src="/mpms-logo-text.png" alt="MPMS" style={{ height: 56, objectFit: 'contain' }} />
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            onClick={() => setCollapsed(true)}
            aria-label={t('nav.aria.collapseSidebar')}
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
          />
        </div>
      )}
    </div>
  );

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {!fullscreen && !isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          theme="dark"
          trigger={null}
          style={{ height: '100vh', position: 'sticky', top: 0, left: 0 }}
        >
          {sidebarBody}
        </Sider>
      )}
      {!fullscreen && isMobile && (
        <>
          <Button
            type="primary"
            shape="circle"
            icon={<MenuOutlined />}
            onClick={() => setMobileDrawerOpen(true)}
            style={{
              position: 'fixed',
              top: 10,
              left: 10,
              zIndex: 999,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
            aria-label={t('nav.aria.openMenu')}
          />
          <Drawer
            placement="left"
            width={260}
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            closable={false}
            styles={{
              body: { padding: 0, background: '#001529' },
              header: { display: 'none' },
            }}
          >
            {sidebarBody}
          </Drawer>
        </>
      )}
      <Layout style={{ overflow: 'hidden' }}>
        <Content
          style={{
            margin: fullscreen ? 0 : (isMobile ? 12 : 24),
            padding: fullscreen ? 12 : (isMobile ? 12 : 24),
            // Slightly more breathing room above the page Title on desktop
            // — many pages override `Title style={{ margin: 0 }}` which made
            // them feel cramped vs. dashboard (which keeps antd defaults).
            // On mobile we leave room for the floating hamburger button
            // (≈ 32 + 10 = 42, plus a small buffer).
            paddingTop: fullscreen ? 12 : (isMobile ? 48 : 32),
            background: themeToken.colorBgContainer,
            borderRadius: fullscreen ? 0 : themeToken.borderRadius,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          {!fullscreen && <ConnectionAlert />}
          <Suspense
            fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, minHeight: 200 }}>
                <Spin size="large" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
