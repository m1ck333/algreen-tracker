import { useTranslation } from '@alblue/i18n';
import { useOfflineStore } from '../offline/offline-store';

/**
 * Shown when one or more queued offline actions were rejected by the server on
 * replay (the process state had moved on — e.g. a coordinator blocked it, or a
 * dependency changed). Surfaces them to the worker so nothing is lost silently;
 * the worker re-checks the item and retries. Dismissible.
 */
export function SyncFailedAlert() {
  const { t } = useTranslation('tablet');
  const failedCount = useOfflineStore((s) => s.failedActions.length);
  const clearFailed = useOfflineStore((s) => s.clearFailedActions);

  if (failedCount === 0) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 text-tablet-sm">
      <div className="font-semibold">{t('offline.failedTitle')}</div>
      <div className="mt-0.5">{t('offline.failedMessage', { count: failedCount })}</div>
      <button
        type="button"
        onClick={clearFailed}
        className="mt-2 underline font-medium"
      >
        {t('offline.dismiss')}
      </button>
    </div>
  );
}
