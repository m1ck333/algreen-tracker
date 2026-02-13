import { useQuery } from '@tanstack/react-query';
import { tabletApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { TabletIncomingDto } from '@algreen/shared-types';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function IncomingOrdersPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();

  const { data: incoming, isLoading } = useQuery({
    queryKey: ['tablet-incoming', processId, tenantId],
    queryFn: () => tabletApi.getIncoming(processId!, tenantId!).then((r) => r.data),
    enabled: !!tenantId && !!processId,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-tablet-lg text-gray-400">{t('common:messages.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-tablet-xl font-bold">{t('incoming.title')}</h1>
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
            <div key={item.orderItemProcessId} className="card border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-tablet-lg font-bold">{item.orderNumber}</div>
                  <div className="text-tablet-sm text-gray-500">
                    {item.productName} &middot; {t('queue.qty', { count: item.quantity })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-tablet-sm font-medium">
                    {t('incoming.incoming')}
                  </span>
                  {item.blockingProcesses.length > 0 && (
                    <div className="text-tablet-xs text-orange-600 mt-1">
                      {t('incoming.blocked', { count: item.blockingProcesses.length })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
