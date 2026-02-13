import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { workSessionsApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import { BigButton } from '../../components/BigButton';
import { useTranslation, useEnumTranslation } from '@algreen/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';

export function CheckOutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearWorkSession = useWorkSessionStore((s) => s.clear);
  const { t } = useTranslation('tablet');
  const { tEnum } = useEnumTranslation();

  const checkOutMutation = useMutation({
    mutationFn: () => workSessionsApi.checkOut({ userId: user!.id }),
    onSuccess: () => {
      clearWorkSession();
      logout();
      navigate('/login', { replace: true });
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

      <div className="space-y-3">
        <BigButton
          variant="danger"
          onClick={() => checkOutMutation.mutate()}
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
    </div>
  );
}
