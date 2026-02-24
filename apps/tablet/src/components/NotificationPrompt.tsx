import { useState, useEffect } from 'react';
import { useTranslation } from '@algreen/i18n';
import { subscribeToPush } from '../services/push';

const DISMISSED_KEY = 'algreen_notif_prompt_dismissed';

export function NotificationPrompt() {
  const { t } = useTranslation('tablet');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Never show again if user already interacted with the prompt
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (
      'Notification' in window &&
      'PushManager' in window &&
      Notification.permission === 'default'
    ) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  const handleEnable = async () => {
    await subscribeToPush();
    dismiss();
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
        onClick={dismiss}
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
