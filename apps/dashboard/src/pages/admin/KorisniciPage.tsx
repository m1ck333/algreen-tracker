import { Tabs } from 'antd';
import { useAuthStore } from '@alblue/auth';
import { UserRole } from '@alblue/shared-types';
import { useTranslation } from '@alblue/i18n';
import { PageHeader } from '../../components/PageHeader';
import { UsersPage } from './UsersPage';
import { SuperAdminsPanel } from './SuperAdminsPanel';

/**
 * "Korisnici" — consolidated user management. Adds a "Sistem
 * administratori" tab visible only to SuperAdmin so they don't need a
 * separate sidebar item (Milos 15.06.2026 sidebar bloat cleanup).
 *
 * For tenant Admins / Managers the page is identical to the old UsersPage
 * — we shortcut the Tabs render and just embed UsersPage with its own
 * header. SuperAdmin sees the merged page header + two tabs.
 */
export function KorisniciPage() {
  const { t } = useTranslation('dashboard');
  const userRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = userRole === UserRole.SuperAdmin;

  if (!isSuperAdmin) {
    return <UsersPage />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <PageHeader title={t('admin.users.title')} />
      <Tabs
        defaultActiveKey="korisnici"
        items={[
          {
            key: 'korisnici',
            label: t('admin.users.tabTenantUsers'),
            children: <UsersPage hideHeader />,
          },
          {
            key: 'system',
            label: t('admin.systemAdmins.title'),
            children: <SuperAdminsPanel />,
          },
        ]}
      />
    </div>
  );
}
