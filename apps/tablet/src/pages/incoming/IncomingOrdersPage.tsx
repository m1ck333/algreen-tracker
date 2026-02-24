import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tabletApi, processesApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { TabletIncomingDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function IncomingOrdersPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();

  const { data: incoming, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tablet-incoming', processId, tenantId],
    queryFn: () => tabletApi.getIncoming(processId!, tenantId!).then((r) => r.data),
    enabled: !!tenantId && !!processId,
    refetchInterval: 60_000,
  });

  // Fetch all processes for name lookup (hits cache from CheckInPage)
  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });

  const processNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (processes) {
      for (const p of processes) {
        map.set(p.id, p.name);
      }
    }
    return map;
  }, [processes]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <span className="inline-block w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <span className="text-tablet-sm text-gray-400">{t('common:messages.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-tablet-base text-red-600">{t('incoming.loadFailed')}</p>
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
        <h1 className="text-tablet-xl font-bold">{t('incoming.title')}</h1>
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
        {t('incoming.subtitle')}
      </p>

      {!incoming?.length ? (
        <div className="text-center text-gray-400 py-12 text-tablet-base">
          {t('incoming.noOrders')}
        </div>
      ) : (
        <div className="space-y-3">
          {incoming.map((item) => (
            <IncomingCard
              key={item.orderItemProcessId}
              item={item}
              processNameMap={processNameMap}
              t={t}
              tEnum={tEnum}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IncomingCard({
  item,
  processNameMap,
  t,
  tEnum,
}: {
  item: TabletIncomingDto;
  processNameMap: Map<string, string>;
  t: (key: string, opts?: Record<string, unknown>) => string;
  tEnum: (enumName: string, value: string) => string;
}) {
  const daysUntilDelivery = Math.ceil(
    (new Date(item.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const borderColor =
    daysUntilDelivery <= 3
      ? 'border-red-300'
      : daysUntilDelivery <= 5
        ? 'border-yellow-300'
        : 'border-gray-200';

  return (
    <div className={`card border-2 ${borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-tablet-lg font-bold">{item.orderNumber}</span>
          <span className="bg-primary-500 text-white px-2 py-0.5 rounded-full text-tablet-xs font-medium">
            P{item.priority}
          </span>
        </div>
        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-tablet-sm font-medium">
          {t('incoming.incoming')}
        </span>
      </div>

      <div className="flex items-center justify-between text-tablet-sm text-gray-600 mb-2">
        <span>{item.productName}</span>
        <span>{t('queue.qty', { count: item.quantity })}</span>
        <span className={daysUntilDelivery <= 3 ? 'text-red-600 font-bold' : ''}>
          {t('incoming.daysLeft', { count: daysUntilDelivery })}
        </span>
      </div>

      <div className="flex items-center justify-between text-tablet-xs mb-2">
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

      {item.blockingProcesses.length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
          <span className="text-tablet-xs text-orange-600 font-medium">{t('incoming.blockedBy')}</span>
          {item.blockingProcesses.map((bp) => (
            <div key={bp.orderItemProcessId} className="flex items-center justify-between text-tablet-xs">
              <span className="text-gray-700">{processNameMap.get(bp.processId) ?? bp.processId}</span>
              <span className="text-gray-500">{tEnum('ProcessStatus', bp.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
