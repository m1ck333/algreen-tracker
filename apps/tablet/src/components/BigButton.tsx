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
      {loading && (
        <span className="inline-block w-6 h-6 border-3 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
