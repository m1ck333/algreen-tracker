import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tabletApi, processWorkflowApi, subProcessWorkflowApi, processesApi, blockRequestsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { ProcessStatus, SubProcessStatus } from '@algreen/shared-types';
import type { TabletSubProcessDto } from '@algreen/shared-types';
import { BigButton } from '../../components/BigButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

function getApiErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function getTranslatedError(error: unknown, t: (key: string, opts?: Record<string, string>) => string, fallback: string): string {
  const code = getApiErrorCode(error);
  if (code) {
    const translated = t(`common:errors.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return fallback;
}

export function WorkPage() {
  const { orderItemProcessId } = useParams<{ orderItemProcessId: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const tenantId = useAuthStore((s) => s.tenantId);
  const processId = useWorkSessionStore((s) => s.processId);
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [activeMutationId, setActiveMutationId] = useState<string | null>(null);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();

  const { data: activeWork } = useQuery({
    queryKey: ['tablet-active', processId, tenantId],
    queryFn: () => tabletApi.getActive(processId!, tenantId!).then((r) => r.data),
    enabled: !!processId && !!tenantId,
    refetchInterval: 120_000,
  });

  // Fetch process definition for sub-process name lookup
  const { data: processDefinition } = useQuery({
    queryKey: ['process', processId],
    queryFn: () => processesApi.getById(processId!).then((r) => r.data),
    enabled: !!processId,
    staleTime: 5 * 60_000,
  });

  const subProcessNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (processDefinition?.subProcesses) {
      for (const sp of processDefinition.subProcesses) {
        map.set(sp.id, sp.name);
      }
    }
    return map;
  }, [processDefinition]);

  const currentWork = activeWork?.find((w) => w.orderItemProcessId === orderItemProcessId);
  const isWorking = currentWork?.status === ProcessStatus.InProgress;

  useEffect(() => {
    if (currentWork?.totalDurationMinutes) {
      setElapsed(currentWork.totalDurationMinutes * 60);
    }
  }, [currentWork?.totalDurationMinutes]);

  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isWorking]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tablet-active'] });
    queryClient.invalidateQueries({ queryKey: ['tablet-queue'] });
  };

  const handleError = (err: unknown, fallbackKey: string) => {
    setError(getTranslatedError(err, t, t(fallbackKey)));
  };

  const startMutation = useMutation({
    mutationFn: () => processWorkflowApi.start(orderItemProcessId!, { userId: userId! }),
    onSuccess: () => { setError(null); invalidate(); },
    onError: (err) => handleError(err, 'work.startFailed'),
  });

  const stopMutation = useMutation({
    mutationFn: () => processWorkflowApi.stop(orderItemProcessId!, { userId: userId! }),
    onSuccess: () => { setError(null); invalidate(); },
    onError: (err) => handleError(err, 'work.stopFailed'),
  });

  const completeMutation = useMutation({
    mutationFn: () => processWorkflowApi.complete(orderItemProcessId!),
    onSuccess: () => {
      setError(null);
      setShowCompleteConfirm(false);
      invalidate();
      navigate('/queue');
    },
    onError: (err) => {
      setShowCompleteConfirm(false);
      handleError(err, 'work.completeFailed');
    },
  });

  const startSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.start(id, { userId: userId! }),
    onSuccess: () => { setError(null); setActiveMutationId(null); invalidate(); },
    onError: (err) => { setActiveMutationId(null); handleError(err, 'work.startFailed'); },
  });

  const completeSubMutation = useMutation({
    mutationFn: (id: string) => subProcessWorkflowApi.complete(id, { userId: userId! }),
    onSuccess: () => { setError(null); setActiveMutationId(null); invalidate(); },
    onError: (err) => { setActiveMutationId(null); handleError(err, 'work.completeFailed'); },
  });

  const blockMutation = useMutation({
    mutationFn: () =>
      blockRequestsApi.create({
        tenantId: tenantId!,
        orderItemProcessId: orderItemProcessId!,
        requestedByUserId: userId!,
        requestNote: blockReason,
      }),
    onSuccess: () => {
      setError(null);
      setShowBlockModal(false);
      setBlockReason('');
      invalidate();
    },
    onError: (err) => {
      setShowBlockModal(false);
      handleError(err, 'work.blockFailed');
    },
  });

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const daysUntilDelivery = currentWork
    ? Math.ceil((new Date(currentWork.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-tablet-xl font-bold text-center">{t('work.title')}</h1>

      {/* Order details */}
      {currentWork && (
        <div className="card py-3">
          <div className="text-center mb-2">
            <span className="text-tablet-lg font-bold">{currentWork.orderNumber}</span>
            <span className="text-tablet-sm text-gray-500 ml-2">{currentWork.productName}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-tablet-xs">
            <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5">
              <span className="text-gray-500">{t('work.priority')}</span>
              <span className="font-semibold">P{currentWork.priority}</span>
            </div>
            <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5">
              <span className="text-gray-500">{t('work.quantity')}</span>
              <span className="font-semibold">{currentWork.quantity}</span>
            </div>
            <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5">
              <span className="text-gray-500">{t('work.deliveryDate')}</span>
              <span className={`font-semibold ${daysUntilDelivery !== null && daysUntilDelivery <= 3 ? 'text-red-600' : ''}`}>
                {`${daysUntilDelivery}d`}
              </span>
            </div>
            {currentWork.complexity && (
              <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5">
                <span className="text-gray-500">{t('work.complexity')}</span>
                <span className="font-semibold">{tEnum('ComplexityType', currentWork.complexity)}</span>
              </div>
            )}
            {currentWork.startedAt && (
              <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5 col-span-2">
                <span className="text-gray-500">{t('work.startedAt')}</span>
                <span className="font-semibold">
                  {new Date(currentWork.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            <div className="flex justify-between bg-gray-50 rounded px-3 py-1.5 col-span-2">
              <span className="text-gray-500">{t('work.progress')}</span>
              <span className="font-semibold">
                {currentWork.completedProcessCount}/{currentWork.totalProcessCount}
              </span>
            </div>
          </div>
          {currentWork.specialRequestNames.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {currentWork.specialRequestNames.map((name) => (
                <span key={name} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-tablet-xs font-medium">
                  {name}
                </span>
              ))}
            </div>
          )}
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

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-tablet-sm">
          {error}
        </div>
      )}

      {/* Sub-processes */}
      {currentWork?.subProcesses && currentWork.subProcesses.length > 0 && (
        <div className="card">
          <h2 className="text-tablet-lg font-semibold mb-3">{t('work.subProcesses')}</h2>
          <div className="space-y-2">
            {currentWork.subProcesses.map((sp) => (
              <SubProcessRow
                key={sp.id}
                subProcess={sp}
                name={subProcessNameMap.get(sp.subProcessId)}
                isLoading={activeMutationId === sp.id}
                onStart={() => { setActiveMutationId(sp.id); startSubMutation.mutate(sp.id); }}
                onComplete={() => { setActiveMutationId(sp.id); completeSubMutation.mutate(sp.id); }}
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
            onClick={() => { setError(null); startMutation.mutate(); }}
            loading={startMutation.isPending}
          >
            {t('work.start')}
          </BigButton>
        ) : (
          <>
            <BigButton
              variant="danger"
              onClick={() => { setError(null); stopMutation.mutate(); }}
              loading={stopMutation.isPending}
            >
              {t('work.stop')}
            </BigButton>
            <BigButton
              onClick={() => { setError(null); setShowCompleteConfirm(true); }}
              loading={completeMutation.isPending}
            >
              {t('work.complete')}
            </BigButton>
          </>
        )}

        <BigButton
          variant="secondary"
          onClick={() => setShowBlockModal(true)}
        >
          {t('work.reportIssue')}
        </BigButton>

        <BigButton
          variant="secondary"
          onClick={() => navigate('/queue')}
        >
          {t('work.backToQueue')}
        </BigButton>
      </div>

      {/* Complete confirmation dialog */}
      <ConfirmDialog
        open={showCompleteConfirm}
        title={t('work.confirmCompleteTitle')}
        message={t('work.confirmCompleteMessage')}
        confirmLabel={t('work.complete')}
        cancelLabel={t('common:actions.cancel')}
        variant="primary"
        loading={completeMutation.isPending}
        onConfirm={() => completeMutation.mutate()}
        onCancel={() => setShowCompleteConfirm(false)}
      />

      {/* Block request modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-tablet-lg font-bold text-center">{t('work.reportIssue')}</h2>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder={t('work.blockReasonPlaceholder')}
              className="w-full border border-gray-300 rounded-xl p-3 text-tablet-sm min-h-[120px] resize-none"
            />
            <div className="space-y-3">
              <button
                onClick={() => blockMutation.mutate()}
                disabled={!blockReason.trim() || blockMutation.isPending}
                className="w-full min-h-[48px] rounded-xl text-tablet-base font-semibold bg-red-600 text-white active:bg-red-700 disabled:opacity-50"
              >
                {blockMutation.isPending ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t('work.submitBlock')
                )}
              </button>
              <button
                onClick={() => { setShowBlockModal(false); setBlockReason(''); }}
                disabled={blockMutation.isPending}
                className="w-full min-h-[48px] rounded-xl text-tablet-base font-semibold bg-gray-100 text-gray-700 active:bg-gray-200 disabled:opacity-50"
              >
                {t('common:actions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubProcessRow({
  subProcess,
  name,
  isLoading,
  onStart,
  onComplete,
  tEnum,
  t,
}: {
  subProcess: TabletSubProcessDto;
  name?: string;
  isLoading: boolean;
  onStart: () => void;
  onComplete: () => void;
  tEnum: (enumName: string, value: string) => string;
  t: (key: string) => string;
}) {
  const isActive = subProcess.status === SubProcessStatus.InProgress;
  const isCompleted = subProcess.status === SubProcessStatus.Completed;
  const isPending = subProcess.status === SubProcessStatus.Pending;
  const isWithdrawn = subProcess.isWithdrawn;

  if (isWithdrawn) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200 opacity-60">
        <div>
          <span className="text-tablet-sm font-medium line-through">
            {name ?? tEnum('SubProcessStatus', subProcess.status)}
          </span>
          <span className="text-tablet-xs text-red-500 ml-2">{t('work.withdrawn')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      isCompleted ? 'bg-green-50 border-green-200' :
      isActive ? 'bg-blue-50 border-blue-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div>
        <span className="text-tablet-sm font-medium">
          {name ?? tEnum('SubProcessStatus', subProcess.status)}
        </span>
        {name && (
          <span className="text-tablet-xs text-gray-500 ml-2">
            {tEnum('SubProcessStatus', subProcess.status)}
          </span>
        )}
        <span className="text-tablet-xs text-gray-500 ml-2">
          {subProcess.totalDurationMinutes} {t('work.min')}
        </span>
      </div>
      <div>
        {isPending && (
          <button
            onClick={onStart}
            disabled={isLoading}
            className="bg-primary-500 text-white px-4 py-1 rounded text-tablet-sm min-w-[70px] flex items-center justify-center"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('work.start')
            )}
          </button>
        )}
        {isActive && (
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="bg-green-500 text-white px-4 py-1 rounded text-tablet-sm min-w-[70px] flex items-center justify-center"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t('work.complete')
            )}
          </button>
        )}
        {isCompleted && (
          <span className="text-green-600 text-tablet-sm">{'\u2713'}</span>
        )}
      </div>
    </div>
  );
}
