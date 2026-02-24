import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tabletApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { ProcessStatus } from '@algreen/shared-types';
import type { TabletQueueItemDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function OrderQueuePage() {
  const navigate = useNavigate();
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const { t } = useTranslation('tablet');

  const { data: queue, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tablet-queue', processId, tenantId],
    queryFn: () => tabletApi.getQueue(processId!, tenantId!).then((r) => r.data),
    enabled: !!tenantId && !!processId,
    refetchInterval: 60_000,
  });

  const sortedQueue = [...(queue ?? [])].sort((a, b) => a.priority - b.priority);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <span className="inline-block w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <span className="text-tablet-sm text-gray-400">{t('queue.loadingQueue')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-tablet-base text-red-600">{t('queue.loadFailed')}</p>
        <button
          onClick={() => refetch()}
          className="bg-primary-500 text-white px-6 py-3 rounded-xl text-tablet-sm font-semibold"
        >
          {t('checkin.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-tablet-xl font-bold">{t('queue.title')}</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg text-gray-500 active:bg-gray-100 disabled:opacity-50"
        >
          <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={isFetching ? 'animate-spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
      <p className="text-gray-500 text-tablet-sm">
        {sortedQueue.length === 1
          ? t('queue.activeOrder', { count: sortedQueue.length })
          : t('queue.activeOrders', { count: sortedQueue.length })}
      </p>

      {sortedQueue.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-tablet-base">
          {t('queue.noOrders')}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedQueue.map((item) => (
            <QueueCard
              key={item.orderItemProcessId}
              item={item}
              onSelect={() => navigate(`/work/${item.orderItemProcessId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ item, onSelect }: { item: TabletQueueItemDto; onSelect: () => void }) {
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();
  const daysUntilDelivery = Math.ceil(
    (new Date(item.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const urgencyColor =
    daysUntilDelivery <= 3
      ? 'bg-red-100 border-red-300'
      : daysUntilDelivery <= 5
        ? 'bg-yellow-50 border-yellow-300'
        : 'bg-white border-gray-200';

  const isBlocked = item.status === ProcessStatus.Blocked;
  const isStopped = item.status === ProcessStatus.Stopped;

  return (
    <button onClick={onSelect} className={`card w-full text-left border-2 ${urgencyColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-tablet-lg font-bold">{item.orderNumber}</span>
          {isBlocked && (
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
              {tEnum('ProcessStatus', ProcessStatus.Blocked)}
            </span>
          )}
          {isStopped && (
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
              {tEnum('ProcessStatus', ProcessStatus.Stopped)}
            </span>
          )}
        </div>
        <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-tablet-sm font-medium">
          P{item.priority}
        </span>
      </div>
      <div className="flex items-center justify-between text-tablet-sm text-gray-600">
        <span>{item.productName}</span>
        <span>{t('queue.qty', { count: item.quantity })}</span>
        {item.complexity && <span>{tEnum('ComplexityType', item.complexity)}</span>}
        <span
          className={daysUntilDelivery <= 3 ? 'text-red-600 font-bold' : ''}
        >
          {t('queue.daysLeft', { count: daysUntilDelivery })}
        </span>
      </div>
      {/* Progress + Special Requests */}
      <div className="flex items-center justify-between mt-2 text-tablet-xs">
        <span className="text-gray-500">
          {t('queue.progress', { completed: item.completedProcessCount, total: item.totalProcessCount })}
        </span>
        {item.specialRequestNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.specialRequestNames.map((name) => (
              <span key={name} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-tablet-xs">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
