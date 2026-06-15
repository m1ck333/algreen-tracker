import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, theme, Grid, Button, Drawer, Spin, Alert } from 'antd';
import { MenuOutlined, CloseOutlined, LeftOutlined, RightOutlined, EyeOutlined, LogoutOutlined } from '@ant-design/icons';
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const tenantId = useAuthStore((s) => s.tenantId);
  const isCrossTenantSession = useAuthStore((s) => s.isCrossTenantSession);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
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
  // Sider's children on desktop and as the Drawer's body on mobile. On
  // mobile the logo row also carries an inline X to close the drawer, so
  // we don't burn a whole second row on a header title.
  const sidebarBody = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          height: 72,
          margin: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'center',
          overflow: 'hidden',
          flexShrink: 0,
          gap: 8,
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
        {isMobile && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ color: '#fff', fontSize: 16 }} />}
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Zatvori meni"
          />
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <SidebarMenu collapsed={isMobile ? false : collapsed} />
      </div>
      <SidebarFooter collapsed={isMobile ? false : collapsed} />
      {/* Single footer row combining the MPMS product mark + the
          sidebar collapse toggle. antd Sider's default `trigger` is
          disabled below (`trigger={null}`) so this is the only thing
          at the bottom — no double footer.
          Expanded: MPMS logo left, chevron right, one horizontal row.
          Collapsed: MPMS square + chevron stacked vertically, both
          centered, keeps the brand visible in icon-rail mode.
          Mobile: only the MPMS mark (drawer has its own close button
          in the top logo row). */}
      {isMobile ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px', opacity: 0.65, flexShrink: 0 }}>
          <img src="/mpms-logo-text.png" alt="MPMS" style={{ height: 32, objectFit: 'contain' }} />
        </div>
      ) : collapsed ? (
        // Collapsed rail — only the expand chevron. MPMS mark hidden:
        // the square asset still showed up as a tiny logo above the
        // chevron and Milos 14.06.2026 found it noisy in icon-rail
        // mode. Top of sidebar already carries the brand when
        // collapsed (mpms-logo.png), so we're not losing it product-wide.
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px', flexShrink: 0 }}>
          <Button
            type="text"
            size="small"
            icon={<RightOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            onClick={() => setCollapsed(false)}
            aria-label="Otvori sidebar"
          />
        </div>
      ) : (
        // Padding-left 24 aligns the MPMS mark with the menu-item icons
        // above (Info / Obaveštenja / Admin User); padding-right 16
        // lines the collapse button up with the dropdown carets antd
        // renders on expandable menu items. Reads as part of the menu,
        // not a floating bottom row (Milos screenshot 14.06.2026).
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 8px 24px', flexShrink: 0 }}>
          <img src="/mpms-logo-text.png" alt="MPMS" style={{ height: 28, objectFit: 'contain', opacity: 0.65 }} />
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined style={{ color: 'rgba(255,255,255,0.85)' }} />}
            onClick={() => setCollapsed(true)}
            aria-label="Skupi sidebar"
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
            aria-label="Otvori meni"
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
          {!fullscreen && isCrossTenantSession && (
            // Persistent banner during cross-tenant SuperAdmin sessions.
            // Eye icon + warning color + "vrati se" CTA so the operator can
            // never confuse this session with their normal home-tenant one.
            // BE middleware enforces read-only too — banner is the UX cue.
            <Alert
              type="warning"
              showIcon
              icon={<EyeOutlined />}
              message={t('crossTenant.banner')}
              style={{ marginBottom: 16 }}
              action={
                <Button
                  size="small"
                  type="primary"
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  {t('crossTenant.exit')}
                </Button>
              }
            />
          )}
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
