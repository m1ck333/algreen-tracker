import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@alblue/auth';
import { workSessionsApi, processWorkflowApi } from '@alblue/api-client';
import { useTranslation } from '@alblue/i18n';
import { useWorkSessionStore } from '../../stores/work-session-store';
import { subscribeToPush } from '../../services/push';

export function TabletLoginPage() {
  const navigate = useNavigate();
  const { login, logout, isLoading, error } = useAuthStore();
  const setCheckInTime = useWorkSessionStore((s) => s.setCheckInTime);
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [settingUp, setSettingUp] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { t } = useTranslation('tablet');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password, tenantCode);

      const { user } = useAuthStore.getState();
      if (!user) {
        navigate('/queue', { replace: true });
        return;
      }

      setSettingUp(true);

      // Clear any leftover auto-logout flag from a prior session in this
      // tab. AutoLogoutBanner persists the flag to sessionStorage so a
      // refresh-while-blocker-up keeps the blocker; without clearing here
      // a fresh login in the same tab would still hit the blocker (Bojan
      // 04.06.2026 — tablet showed login screen while dashboard showed
      // workers as still logged in).
      if (typeof window !== 'undefined') sessionStorage.removeItem('tablet.autoLoggedOut');

      // Check in (tenant derived from JWT). If the worker has used up
      // their MaxOvertimeHours for today, BE returns 400 OVERTIME_EXHAUSTED
      // — block the login and clear the JWT so the worker can't proceed to
      // the queue. Saša 08.06.2026 (Bug 1).
      try {
        await workSessionsApi.checkIn({ userId: user.id });
      } catch (checkInErr) {
        const code = (checkInErr as { response?: { data?: { error?: { code?: string } } } })
          ?.response?.data?.error?.code;
        if (code === 'OVERTIME_EXHAUSTED') {
          setLocalError(t('login.overtimeExhausted'));
          logout();
          setSettingUp(false);
          return;
        }
        // Other failures: non-critical, proceed
      }

      // Resume any processes that were auto-paused at the last logout.
      // BE only resumes items marked PausedOnLogoutAt — so manual pauses
      // stay paused. Failures are non-critical: worker can still start
      // work manually.
      if (user.processes?.length) {
        await Promise.allSettled(
          user.processes.map((p) =>
            processWorkflowApi.resumeOnLogin({ processId: p.processId, userId: user.id }),
          ),
        );
      }

      setCheckInTime(new Date().toISOString());

      // Subscribe to push notifications (non-blocking)
      subscribeToPush().then(
        (ok) => console.log('[Push] subscribeToPush result:', ok),
        (err) => console.error('[Push] subscribeToPush error:', err),
      );

      navigate('/queue', { replace: true });
    } catch {
      // Login failed — error is handled by auth store
    } finally {
      setSettingUp(false);
    }
  };

  const submitting = isLoading || settingUp;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="card w-full max-w-md overflow-hidden p-0">
        {/* Logo lives in its own navy band so the dark-on-dark MPMS mark
            stays legible. Same pattern as dashboard LoginPage. */}
        <div className="flex justify-center" style={{ background: '#001529', padding: '24px 0' }}>
          <img
            src="/mpms-logo-text.png"
            alt="MPMS"
            style={{ height: 120, objectFit: 'contain' }}
          />
        </div>
        <div className="p-6">
        <p className="text-center text-gray-500 mb-8 text-tablet-sm">
          {t('login.subtitle')}
        </p>

        {(localError || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-tablet-sm">
            {localError ?? (t(`common:errors.${error === 'NOT_FOUND' ? 'INVALID_CREDENTIALS' : error}`, { defaultValue: '' }) || t('login.failed'))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-tablet-sm font-medium text-gray-700 mb-2">
              {t('login.tenantCode')}
            </label>
            <input
              type="text"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              className="w-full px-4 py-4 border border-gray-300 rounded-xl text-tablet-base focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-tablet-sm font-medium text-gray-700 mb-2">
              {t('login.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-4 border border-gray-300 rounded-xl text-tablet-base focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-tablet-sm font-medium text-gray-700 mb-2">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 border border-gray-300 rounded-xl text-tablet-base focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-4"
          >
            {submitting ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
