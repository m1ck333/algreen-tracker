import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { workSessionsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
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

export function CheckOutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearWorkSession = useWorkSessionStore((s) => s.clear);
  const processName = useWorkSessionStore((s) => s.processName);
  const checkInTime = useWorkSessionStore((s) => s.checkInTime);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const checkOutMutation = useMutation({
    mutationFn: () => workSessionsApi.checkOut({ userId: user!.id }),
    onSuccess: () => {
      clearWorkSession();
      logout();
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      setShowConfirm(false);
      const code = getApiErrorCode(err);
      if (code === 'NOT_CHECKED_IN') {
        clearWorkSession();
        logout();
        navigate('/login', { replace: true });
      } else {
        setError(getTranslatedError(err, t, t('checkout.checkOutFailed')));
      }
    },
  });

  return (
    <div className="space-y-6 pt-8">
      <h1 className="text-tablet-xl font-bold text-center">{t('checkout.title')}</h1>

      <div className="card text-center py-6">
        <div className="text-tablet-2xl font-bold text-gray-700">
          {user?.fullName}
        </div>
        <div className="text-tablet-sm text-gray-500 mt-1">
          {user?.role ? tEnum('UserRole', user.role) : ''}
        </div>
      </div>

      {/* Shift summary */}
      {(processName || checkInTime) && (
        <div className="card space-y-2">
          {processName && (
            <div className="flex justify-between text-tablet-sm">
              <span className="text-gray-500">{t('checkout.process')}</span>
              <span className="font-semibold">{processName}</span>
            </div>
          )}
          {checkInTime && (
            <div className="flex justify-between text-tablet-sm">
              <span className="text-gray-500">{t('checkout.checkedInAt')}</span>
              <span className="font-semibold">
                {new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-tablet-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <BigButton
          variant="danger"
          onClick={() => { setError(null); setShowConfirm(true); }}
          loading={checkOutMutation.isPending}
        >
          {t('checkout.checkOut')}
        </BigButton>

        <BigButton
          variant="secondary"
          onClick={() => navigate('/queue')}
        >
          {t('checkout.goBack')}
        </BigButton>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={t('checkout.confirmTitle')}
        message={t('checkout.confirmMessage')}
        confirmLabel={t('checkout.checkOut')}
        cancelLabel={t('common:actions.cancel')}
        variant="danger"
        loading={checkOutMutation.isPending}
        onConfirm={() => checkOutMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
