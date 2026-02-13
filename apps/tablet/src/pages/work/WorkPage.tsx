import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tabletApi, processWorkflowApi, subProcessWorkflowApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { ProcessStatus, SubProcessStatus } from '@algreen/shared-types';
import type { TabletActiveWorkDto, TabletSubProcessDto } from '@algreen/shared-types';
import { BigButton } from '../../components/BigButton';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function WorkPage() {
  const { orderItemProcessId } = useParams<{ orderItemProcessId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();

  const { data: activeWork } = useQuery({
    queryKey: ['tablet-active', processId, tenantId],
    queryFn: () => tabletApi.getActive(processId!, tenantId!).then((r) => r.data),
    enabled: !!processId && !!tenantId,
    refetchInterval: 120_000,
  });

  const currentWork = activeWork?.find((w) => w.orderItemProcessId === orderItemProcessId);
  const isWorking = currentWork?.status === ProcessStatus.InProgress;

  // Initialize elapsed from server data
  useEffect(() => {
    if (currentWork?.totalDurationMinutes) {
      setElapsed(currentWork.totalDurationMinutes * 60);
    }
  }, [currentWork?.totalDurationMinutes]);

  // Timer
  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isWorking]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
  };

  const startMutation = useMutation({
    mutationFn: () => processWorkflowApi.start(orderItemProcessId!, { userId: userId! }),
    onSuccess: invalidate,
  });

  const stopMutation = useMutation({
    mutationFn: () => processWorkflowApi.stop(orderItemProcessId!, { userId: userId! }),
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: () => processWorkflowApi.complete(orderItemProcessId!),
    onSuccess: () => {
      invalidate();
      navigate('/queue');
    },
  });

  const startSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.start(id, { userId: userId! }),
    onSuccess: invalidate,
  });

  const completeSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.complete(id, { userId: userId! }),
    onSuccess: invalidate,
  });

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-tablet-xl font-bold text-center">{t('work.title')}</h1>

      {currentWork && (
        <div className="card text-center py-2">
          <div className="text-tablet-sm text-gray-500">
            {currentWork.orderNumber} &middot; {currentWork.productName}
          </div>
        </div>
      )}

      {/* Timer */}
      <div className="card text-center py-8">
        <div className="text-6xl font-mono font-bold text-primary-500">
          {formatTime(elapsed)}
        </div>
        <p className="text-gray-500 mt-2 text-tablet-sm">
          {isWorking ? t('work.working') : t('work.readyToStart')}
        </p>
      </div>

      {/* Sub-processes */}
      {currentWork?.subProcesses && currentWork.subProcesses.length > 0 && (
        <div className="card">
          <h2 className="text-tablet-lg font-semibold mb-3">{t('work.subProcesses')}</h2>
          <div className="space-y-2">
            {currentWork.subProcesses.map((sp) => (
              <SubProcessRow
                key={sp.id}
                subProcess={sp}
                onStart={() => startSubMutation.mutate(sp.id)}
                onComplete={() => completeSubMutation.mutate(sp.id)}
                tEnum={tEnum}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {!isWorking ? (
          <BigButton
            onClick={() => startMutation.mutate()}
            loading={startMutation.isPending}
          >
            {t('work.start')}
          </BigButton>
        ) : (
          <>
            <BigButton
              variant="danger"
              onClick={() => stopMutation.mutate()}
              loading={stopMutation.isPending}
            >
              {t('work.stop')}
            </BigButton>
            <BigButton
              onClick={() => completeMutation.mutate()}
              loading={completeMutation.isPending}
            >
              {t('work.complete')}
            </BigButton>
          </>
        )}

        <BigButton
          variant="secondary"
          onClick={() => navigate('/queue')}
        >
          {t('work.backToQueue')}
        </BigButton>
      </div>
    </div>
  );
}

function SubProcessRow({
  subProcess,
  onStart,
  onComplete,
  tEnum,
  t,
}: {
  subProcess: TabletSubProcessDto;
  onStart: () => void;
  onComplete: () => void;
  tEnum: (enumName: string, value: string) => string;
  t: (key: string) => string;
}) {
  const isActive = subProcess.status === SubProcessStatus.InProgress;
  const isCompleted = subProcess.status === SubProcessStatus.Completed;
  const isPending = subProcess.status === SubProcessStatus.Pending;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      isCompleted ? 'bg-green-50 border-green-200' :
      isActive ? 'bg-blue-50 border-blue-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div>
        <span className="text-tablet-sm font-medium">
          {tEnum('SubProcessStatus', subProcess.status)}
        </span>
        <span className="text-tablet-xs text-gray-500 ml-2">
          {subProcess.totalDurationMinutes} {t('work.min')}
        </span>
      </div>
      <div>
        {isPending && (
          <button
            onClick={onStart}
            className="bg-primary-500 text-white px-4 py-1 rounded text-tablet-sm"
          >
            {t('work.start')}
          </button>
        )}
        {isActive && (
          <button
            onClick={onComplete}
            className="bg-green-500 text-white px-4 py-1 rounded text-tablet-sm"
          >
            {t('work.complete')}
          </button>
        )}
        {isCompleted && (
          <span className="text-green-600 text-tablet-sm">✓</span>
        )}
      </div>
    </div>
  );
}
