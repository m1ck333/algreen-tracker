import { Segmented } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from '@alblue/i18n';

/**
 * Compact language switcher for public pages (login, /about) — the
 * regular one lives in the sidebar profile menu which is auth-gated.
 */
export function PublicLanguageSwitcher() {
  const { i18n, t } = useTranslation('dashboard');
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }}>
      <Segmented
        size="small"
        value={i18n.language === 'en' ? 'en' : 'sr'}
        onChange={(v) => i18n.changeLanguage(v as string)}
        options={[
          { label: t('language.sr'), value: 'sr', icon: <GlobalOutlined /> },
          { label: t('language.en'), value: 'en' },
        ]}
      />
    </div>
  );
}
