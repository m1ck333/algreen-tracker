import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processesApi, workSessionsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { BigButton } from '../../components/BigButton';
import { useTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function CheckInPage() {
  const navigate = useNavigate();
  const tenantId = useAuthStore((s) => s.tenantId);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const setSessionInfo = useWorkSessionStore((s) => s.setSessionInfo);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const { t } = useTranslation('tablet');

  const { data: processes, isLoading, isError, refetch } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const activeProcesses = processes?.filter((p) => p.isActive) ?? [];
  const selectedProcess = activeProcesses.find((p) => p.id === selectedProcessId);

  const checkInMutation = useMutation({
    mutationFn: () =>
      workSessionsApi.checkIn({
        tenantId: tenantId!,
        processId: selectedProcessId!,
        userId: user!.id,
      }),
    onSuccess: () => {
      setSessionInfo({
        processId: selectedProcessId!,
        processName: selectedProcess?.name ?? '',
        checkInTime: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['work-session'] });
      navigate('/queue');
    },
    onError: (error: { response?: { data?: { error?: { code?: string } } } }) => {
      if (error.response?.data?.error?.code === 'ALREADY_CHECKED_IN') {
        setSessionInfo({
          processId: selectedProcessId!,
          processName: selectedProcess?.name ?? '',
          checkInTime: new Date().toISOString(),
        });
        navigate('/queue');
      }
    },
  });

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
        <p className="text-tablet-base text-red-600">{t('checkin.loadFailed')}</p>
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
    <div className="space-y-6">
      <h1 className="text-tablet-xl font-bold text-center">
        {t('checkin.welcome', { name: user?.firstName })}
      </h1>
      <p className="text-center text-gray-500 text-tablet-base">
        {t('checkin.selectProcess')}
      </p>

      <div className="space-y-3">
        {activeProcesses.map((process) => (
          <button
            key={process.id}
            onClick={() => setSelectedProcessId(process.id)}
            className={`card w-full text-left p-5 transition-all border-2 ${
              selectedProcessId === process.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-transparent'
            }`}
          >
            <div className="text-tablet-lg font-semibold">{process.name}</div>
            <div className="text-tablet-sm text-gray-500">{process.code}</div>
          </button>
        ))}
      </div>

      {activeProcesses.length === 0 && (
        <div className="text-center text-gray-400 py-12 text-tablet-base">
          {t('checkin.noProcesses')}
        </div>
      )}

      <BigButton
        onClick={() => checkInMutation.mutate()}
        disabled={!selectedProcessId}
        loading={checkInMutation.isPending}
      >
        {t('checkin.checkIn')}
      </BigButton>
    </div>
  );
}
