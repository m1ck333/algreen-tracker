import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';

export function StatusBar() {
  const user = useAuthStore((s) => s.user);
  const { i18n } = useTranslation('tablet');

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'sr' ? 'en' : 'sr');
  };

  const isSr = i18n.language === 'sr';

  return (
    <div className="bg-primary-500 text-white px-4 py-3 flex items-center justify-between">
      <img src="/algreen-logo-text.png" alt="AlGreen" className="h-6 object-contain" />
      <div className="flex items-center gap-3">
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
