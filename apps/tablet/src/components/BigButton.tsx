import { useTranslation } from '@algreen/i18n';

interface BigButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function BigButton({
  children,
  variant = 'primary',
  onClick,
  disabled,
  loading,
}: BigButtonProps) {
  const { t } = useTranslation('common');
  const classes = {
    primary: 'btn-primary',
    danger: 'btn-danger',
    secondary: 'btn-secondary',
  };

  return (
    <button
      className={classes[variant]}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="animate-pulse">{t('messages.loading')}</span>
      ) : (
        children
      )}
    </button>
  );
}
