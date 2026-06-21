import { Tabs, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@alblue/auth';
import { tenantsApi } from '@alblue/api-client';
import { UserRole } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import { PageHeader } from '../../components/PageHeader';
import { TenantProfilePage } from './TenantProfilePage';
import { TenantsPage } from './TenantsPage';
import { AllPaymentsPage } from './AllPaymentsPage';

/**
 * "Firma" — consolidated tenant management. Merges what used to be two
 * sidebar items ("Profil firme" + "Firme") into one page with tabs:
 *
 *   - Tab "Profil"     — current user's own tenant (everyone who reaches
 *                        this page sees it; default tab).
 *   - Tab "Sve firme"  — list/create/deactivate all tenants. SuperAdmin
 *                        only. Hidden for tenant Admin → they see only the
 *                        Profil panel without any tab strip, matching what
 *                        Profil firme looked like before this merge.
 *
 * Why merge: sidebar bloat (Milos 15.06.2026). Same mental model "manage
 * the tenant" lives in one entry point.
 */
export function FirmaPage() {
  const { t } = useTranslation('dashboard');
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === UserRole.SuperAdmin;

  const { data: tenant } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy().then((r) => r.data),
  });

  // Non-SA users see only the profile panel; rendering Tabs with a single
  // panel adds a useless strip, so we shortcut and render the panel raw.
  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader
          title={t('admin.tenantProfile.title')}
          subtitle={tenant ? <Typography.Text type="secondary">{tenant.name} · {tenant.code}</Typography.Text> : undefined}
        />
        <TenantProfilePage hideHeader />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader
        title={t('admin.firma.title')}
        subtitle={tenant ? <Typography.Text type="secondary">{tenant.name} · {tenant.code}</Typography.Text> : undefined}
      />
      <Tabs
        defaultActiveKey="profil"
        items={[
          {
            key: 'profil',
            label: t('admin.firma.tabProfile'),
            children: <TenantProfilePage hideHeader />,
          },
          {
            key: 'sve',
            label: t('admin.firma.tabAll'),
            children: <TenantsPage hideHeader />,
          },
          {
            key: 'uplate',
            label: t('admin.firma.tabAllPayments'),
            children: <AllPaymentsPage />,
          },
        ]}
      />
    </div>
  );
}
