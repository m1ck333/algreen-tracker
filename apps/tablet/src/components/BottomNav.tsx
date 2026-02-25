import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@algreen/i18n';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@algreen/auth';
import { notificationsApi } from '@algreen/api-client';

const ListIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const InboxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const BellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('tablet');
  const userId = useAuthStore((s) => s.user?.id) ?? '';

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount(userId).then((r) => r.data),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  const navItems = [
    { path: '/queue', label: t('nav.queue'), icon: <ListIcon />, badge: 0 },
    { path: '/incoming', label: t('nav.incoming'), icon: <InboxIcon />, badge: 0 },
    { path: '/notifications', label: t('nav.notifications'), icon: <BellIcon />, badge: unreadCount },
    { path: '/checkout', label: t('nav.checkOut'), icon: <LogOutIcon />, badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex safe-area-bottom">
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 flex flex-col items-center py-3 relative transition-colors ${
              isActive
                ? 'text-primary-500 bg-primary-50 font-semibold'
                : 'text-gray-400'
            }`}
          >
            {isActive && (
              <span className="absolute top-0 left-2 right-2 h-[3px] bg-primary-500 rounded-b" />
            )}
            <span className="relative">
              {item.icon}
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
