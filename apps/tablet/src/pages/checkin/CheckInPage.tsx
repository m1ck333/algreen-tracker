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
  const setWorkProcessId = useWorkSessionStore((s) => s.setProcessId);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const { t } = useTranslation('tablet');

  const { data: processes } = useQuery({
    queryKey: ['processes', tenantId],
    queryFn: () => processesApi.getAll(tenantId!).then((r) => r.data.items),
    enabled: !!tenantId,
  });

  const checkInMutation = useMutation({
    mutationFn: () =>
      workSessionsApi.checkIn({
        tenantId: tenantId!,
        processId: selectedProcessId!,
        userId: user!.id,
      }),
    onSuccess: () => {
      setWorkProcessId(selectedProcessId!);
      queryClient.invalidateQueries({ queryKey: ['work-session'] });
      navigate('/queue');
    },
    onError: (error: any) => {
      if (error.response?.data?.error?.code === 'ALREADY_CHECKED_IN') {
        setWorkProcessId(selectedProcessId!);
        navigate('/queue');
      }
    },
  });

  const activeProcesses = processes?.filter((p) => p.isActive) ?? [];

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
