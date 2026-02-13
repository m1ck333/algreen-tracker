import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@algreen/i18n';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('tablet');

  const navItems = [
    { path: '/', label: t('nav.checkIn'), icon: '\u{1F3E0}' },
    { path: '/queue', label: t('nav.queue'), icon: '\u{1F4CB}' },
    { path: '/incoming', label: t('nav.incoming'), icon: '\u{1F4E5}' },
    { path: '/checkout', label: t('nav.checkOut'), icon: '\u{1F44B}' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex safe-area-bottom">
      {navItems.map((item) => {
        const isActive =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 flex flex-col items-center py-3 transition-colors ${
              isActive ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
