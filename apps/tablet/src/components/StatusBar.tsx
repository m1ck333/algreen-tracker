import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';

export function StatusBar() {
  const user = useAuthStore((s) => s.user);
  const { t, i18n } = useTranslation('tablet');

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'sr' ? 'en' : 'sr');
  };

  return (
    <div className="bg-primary-500 text-white px-4 py-3 flex items-center justify-between">
      <img src="/algreen-logo-text.png" alt="AlGreen" className="h-6 object-contain" />
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-tablet-sm opacity-90">{user.fullName}</span>
        )}
        <button
          onClick={toggleLanguage}
          className="text-tablet-sm font-medium bg-white/20 px-2 py-0.5 rounded"
        >
          {i18n.language === 'sr' ? t('language.en') : t('language.sr')}
        </button>
      </div>
    </div>
  );
}
