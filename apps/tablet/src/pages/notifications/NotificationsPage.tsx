import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@algreen/auth';
import { notificationsApi } from '@algreen/api-client';
import { useTranslation } from '@algreen/i18n';
import type { NotificationDto } from '@algreen/shared-types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'sada';
  if (mins < 60) return `pre ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `pre ${hours}h`;
  const days = Math.floor(hours / 24);
  return `pre ${days}d`;
}

function notificationIcon(type: string): string {
  switch (type) {
    case 'DeadlineWarning':
    case 'DeadlineCritical':
      return '\u23F0';
    case 'OrderActivated':
    case 'ProcessReadyForQueue':
      return '\uD83D\uDCE5';
    case 'ProcessBlocked':
    case 'BlockRequest':
      return '\uD83D\uDEAB';
    case 'BlockRequestApproved':
      return '\u2705';
    case 'ProcessCompleted':
      return '\u2714\uFE0F';
    default:
      return '\uD83D\uDD14';
  }
}

export function NotificationsPage() {
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const { t } = useTranslation('tablet');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => notificationsApi.getAll({ userId, pageSize: 50 }).then((r) => r.data),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const notifications = data?.items ?? [];
  const hasUnread = notifications.some((n) => !n.isRead);

  const handleTap = (n: NotificationDto) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-tablet-base">{t('notificationsPage.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-tablet-xl font-bold text-gray-800">{t('notificationsPage.title')}</h1>
        {hasUnread && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-tablet-sm text-primary-500 font-semibold py-2 px-4 rounded-lg active:bg-primary-50"
          >
            {t('notificationsPage.markAllRead')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="mt-3 text-tablet-base">{t('notificationsPage.empty')}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleTap(n)}
              className={`w-full text-left rounded-xl p-4 transition-colors active:bg-gray-100 ${
                n.isRead ? 'bg-white' : 'bg-primary-50 border-l-4 border-primary-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {notificationIcon(n.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-tablet-base truncate ${n.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                      {n.title}
                    </span>
                    <span className="text-tablet-xs text-gray-400 flex-shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-tablet-sm text-gray-500 mt-1 line-clamp-2">
                    {n.message}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
