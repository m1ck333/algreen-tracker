import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
    case 'BlockRequestRejected':
      return '\u274C';
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [visibleCount, setVisibleCount] = useState(15);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const allNotifications = data?.items ?? [];
  const filtered = tab === 'unread' ? allNotifications.filter((n) => !n.isRead) : allNotifications;
  const hasUnread = allNotifications.some((n) => !n.isRead);
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  const handleTap = (n: NotificationDto) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    const state = n.referenceId ? { highlightId: n.referenceId } : undefined;

    // Check cached data to find where the order actually is
    const refId = n.referenceId;
    if (refId) {
      type OrderRef = { orderId: string; orderItemProcessId: string };
      const getFirstCached = (prefix: string) => {
        const entries = queryClient.getQueriesData<OrderRef[]>({ queryKey: [prefix] });
        return entries[0]?.[1];
      };

      const match = (items: OrderRef[] | undefined) =>
        items?.some((i) => i.orderId === refId || i.orderItemProcessId === refId);

      if (match(getFirstCached('tablet-queue')) || match(getFirstCached('tablet-active'))) {
        navigate('/queue', { state });
        return;
      }
      if (match(getFirstCached('tablet-incoming'))) {
        navigate('/incoming', { state });
        return;
      }
    }

    // Fallback by notification type when cached data doesn't have the item
    switch (n.type) {
      case 'OrderActivated':
        navigate('/incoming', { state });
        break;
      case 'ProcessCompleted':
      case 'ProcessBlocked':
      case 'BlockRequestApproved':
      case 'DeadlineWarning':
      case 'DeadlineCritical':
        navigate('/queue', { state });
        break;
    }
  };

  const handleTabChange = (newTab: 'all' | 'unread') => {
    setTab(newTab);
    setVisibleCount(15);
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
      <div className="flex items-center justify-between mb-3">
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

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleTabChange('all')}
          className={`px-4 py-2 rounded-full text-tablet-sm font-semibold transition-colors ${
            tab === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {t('notificationsPage.tabAll')}
        </button>
        <button
          onClick={() => handleTabChange('unread')}
          className={`px-4 py-2 rounded-full text-tablet-sm font-semibold transition-colors ${
            tab === 'unread' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {t('notificationsPage.tabUnread')}{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="mt-3 text-tablet-base">
            {tab === 'unread' ? t('notificationsPage.noUnread') : t('notificationsPage.empty')}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, visibleCount).map((n) => (
            <SwipeableNotification
              key={n.id}
              notification={n}
              onTap={handleTap}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 15)}
              className="w-full py-3 text-center text-tablet-sm font-semibold text-primary-500 bg-white rounded-xl border border-gray-200 active:bg-gray-50"
            >
              {t('tablet:common.loadMore', { remaining: filtered.length - visibleCount })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SwipeableNotification({
  notification: n,
  onTap,
  onDelete,
}: {
  notification: NotificationDto;
  onTap: (n: NotificationDto) => void;
  onDelete: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startX.current;
    // Only allow swipe left
    if (diff < 0) {
      currentX.current = diff;
      setOffsetX(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentX.current < -threshold) {
      setSwiped(true);
      setOffsetX(-threshold);
    } else {
      setSwiped(false);
      setOffsetX(0);
    }
  }, []);

  const handleTapInner = useCallback(() => {
    if (swiped) {
      setSwiped(false);
      setOffsetX(0);
    } else {
      onTap(n);
    }
  }, [swiped, onTap, n]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 w-20">
        <button
          onClick={() => onDelete(n.id)}
          className="flex flex-col items-center justify-center w-full h-full text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Foreground notification */}
      <button
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTapInner}
        style={{ transform: `translateX(${offsetX}px)`, transition: currentX.current === 0 ? 'transform 0.2s ease' : 'none' }}
        className={`relative w-full text-left rounded-xl p-4 active:bg-gray-100 ${
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-300 ml-1">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>
    </div>
  );
}
