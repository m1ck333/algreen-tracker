import { useState, useEffect } from 'react';
import { useTranslation } from '@algreen/i18n';
import { subscribeToPush } from '../services/push';

export function NotificationPrompt() {
  const { t } = useTranslation('tablet');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if push is supported and permission not yet decided
    if (
      'Notification' in window &&
      'PushManager' in window &&
      Notification.permission === 'default'
    ) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleEnable = async () => {
    await subscribeToPush();
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-tablet-xs text-blue-800 flex-1">
        {t('notifications.prompt')}
      </span>
      <button
        onClick={handleEnable}
        className="bg-primary-500 text-white px-4 py-2 rounded-lg text-tablet-xs font-semibold flex-shrink-0"
      >
        {t('notifications.enable')}
      </button>
      <button
        onClick={handleDismiss}
        className="text-blue-400 p-1 flex-shrink-0"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
