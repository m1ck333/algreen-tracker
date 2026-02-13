import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tabletApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { TabletQueueItemDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function OrderQueuePage() {
  const navigate = useNavigate();
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const { t } = useTranslation('tablet');

  const { data: queue, isLoading } = useQuery({
    queryKey: ['tablet-queue', processId, tenantId],
    queryFn: () => tabletApi.getQueue(processId!, tenantId!).then((r) => r.data),
    enabled: !!tenantId && !!processId,
    refetchInterval: 60_000,
  });

  const sortedQueue = [...(queue ?? [])].sort((a, b) => a.priority - b.priority);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-tablet-lg text-gray-400">{t('queue.loadingQueue')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-tablet-xl font-bold">{t('queue.title')}</h1>
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
    daysUntilDelivery <= 2
      ? 'bg-red-100 border-red-300'
      : daysUntilDelivery <= 5
        ? 'bg-yellow-50 border-yellow-300'
        : 'bg-white border-gray-200';

  return (
    <button onClick={onSelect} className={`card w-full text-left border-2 ${urgencyColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-tablet-lg font-bold">{item.orderNumber}</span>
        <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-tablet-sm font-medium">
          P{item.priority}
        </span>
      </div>
      <div className="flex items-center justify-between text-tablet-sm text-gray-600">
        <span>{item.productName}</span>
        <span>{t('queue.qty', { count: item.quantity })}</span>
        {item.complexity && <span>{tEnum('ComplexityType', item.complexity)}</span>}
        <span
          className={daysUntilDelivery <= 2 ? 'text-red-600 font-bold' : ''}
        >
          {t('queue.daysLeft', { count: daysUntilDelivery })}
        </span>
      </div>
    </button>
  );
}
