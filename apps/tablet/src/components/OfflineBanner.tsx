import { useState, useEffect } from 'react';
import { useTranslation } from '@algreen/i18n';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { t } = useTranslation('tablet');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 text-yellow-900 text-center py-2 px-4 text-tablet-sm font-medium">
      {t('offline.message')}
    </div>
  );
}
