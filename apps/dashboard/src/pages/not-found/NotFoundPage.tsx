import { Result, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@alblue/i18n';

/**
 * 404 page. Rendered by the catch-all route. Shows the attempted path so
 * a user who landed on an old Serbian path (e.g. /magacin/stanje renamed
 * to /warehouse/stock) sees something useful instead of a blank screen.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('dashboard');

  return (
    <Result
      status="404"
      title="404"
      subTitle={
        <>
          {t('notFound.subtitle', { defaultValue: 'Stranica ne postoji.' })}
          <br />
          <code style={{ fontSize: 12, opacity: 0.7 }}>{location.pathname}</code>
        </>
      }
      extra={
        <Button type="primary" onClick={() => navigate('/', { replace: true })}>
          {t('notFound.backHome', { defaultValue: 'Početna' })}
        </Button>
      }
    />
  );
}
