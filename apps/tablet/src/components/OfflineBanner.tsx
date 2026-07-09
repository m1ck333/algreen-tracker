import { useState, useEffect } from 'react';
import { useTranslation } from '@alblue/i18n';
import { useOfflineStore } from '../offline/offline-store';
import { OFFLINE_WRITES_ENABLED } from '../offline/config';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { t } = useTranslation('tablet');
  const pendingCount = useOfflineStore((s) => s.pendingActions.length);

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

  const hasQueue = OFFLINE_WRITES_ENABLED && pendingCount > 0;

  // Offline: always warn; add the saved-action count when there's a queue.
  if (!isOnline) {
    return (
      <div className="bg-yellow-500 text-yellow-900 text-center py-2 px-4 text-tablet-sm font-medium">
        {t('offline.message')}
        {hasQueue ? ` · ${t('offline.queued', { count: pendingCount })}` : null}
      </div>
    );
  }

  // Online but the queue is still draining — reassure the worker it's syncing.
  if (hasQueue) {
    return (
      <div className="bg-blue-500 text-white text-center py-2 px-4 text-tablet-sm font-medium">
        {t('offline.syncing', { count: pendingCount })}
      </div>
    );
  }

  return null;
}
