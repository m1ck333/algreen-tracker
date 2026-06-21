import { useAuthStore } from '@alblue/auth';
import { useTranslation } from '@alblue/i18n';
import { useTenantLogo } from '../hooks/useTenantLogo';

export function StatusBar() {
  const user = useAuthStore((s) => s.user);
  const { i18n } = useTranslation('tablet');
  const tenantLogoUrl = useTenantLogo();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'sr' ? 'en' : 'sr');
  };

  const isSr = i18n.language === 'sr';

  return (
    <div className="bg-primary-500 text-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {/* Per-tenant logo when uploaded, MPMS mark as placeholder.
            Same pattern as dashboard sidebar top — once the tenant
            Admin uploads a logo on Profil firme, it surfaces here for
            every worker on every tablet of that tenant. */}
        <img
          src={tenantLogoUrl ?? '/mpms-logo-text.png'}
          alt={tenantLogoUrl ? 'Logo' : 'MPMS'}
          className="h-10 object-contain flex-shrink-0"
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {user && (
          <span className="text-tablet-sm opacity-90">{user.fullName}</span>
        )}
        <button
          onClick={toggleLanguage}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center gap-1 text-tablet-sm font-medium bg-white/20 px-3 rounded-lg"
        >
          <span className={isSr ? 'font-bold' : 'opacity-60'}>SR</span>
          <span className="opacity-40">/</span>
          <span className={!isSr ? 'font-bold' : 'opacity-60'}>EN</span>
        </button>
      </div>
    </div>
  );
}
