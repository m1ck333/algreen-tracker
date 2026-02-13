import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';

export function TabletLoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useTranslation('tablet');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, tenantCode);
      navigate('/', { replace: true });
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="card w-full max-w-md">
        <h1 className="text-tablet-2xl font-bold text-center text-primary-500 mb-2">
          {t('common:appName')}
        </h1>
        <p className="text-center text-gray-500 mb-8 text-tablet-sm">
          {t('login.subtitle')}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-tablet-sm">
            {error}
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
            disabled={isLoading}
            className="btn-primary mt-4"
          >
            {isLoading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
