import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Button, Typography, Result, theme, ConfigProvider } from 'antd';
import { useTranslation } from '@alblue/i18n';
import { lightTheme, darkTheme } from '../styles/theme';
import { useThemeStore } from '../stores/theme-store';

const { Paragraph, Text } = Typography;

function DevErrorDetails({ error }: { error: Error }) {
  const { token } = theme.useToken();
  return (
    <Paragraph>
      <Text strong style={{ fontSize: 14, color: token.colorError }}>{error.message}</Text>
      <pre style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary, maxHeight: 200, overflow: 'auto', background: token.colorFillSecondary, padding: 12, borderRadius: token.borderRadius }}>
        {error.stack}
      </pre>
    </Paragraph>
  );
}

// Inner: must live INSIDE the ConfigProvider so `theme.useToken()`
// returns the dark/light tokens the SA actually has selected (the
// outer wrapper applies the provider). Without this split, useToken
// returned antd's default light palette regardless of user theme and
// the Result title was rendered with low-contrast text on a light
// canvas even for dark-mode users (Saša 18.06.2026).
function ErrorBoundaryInner({ error }: { error: Error | null }) {
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 24,
      background: token.colorBgContainer,
      color: token.colorText,
    }}>
      <Result
        status="500"
        title={<span style={{ color: token.colorText }}>{t('errorBoundary.title')}</span>}
        subTitle={<span style={{ color: token.colorTextSecondary }}>{t('errorBoundary.subtitle')}</span>}
        extra={[
          <Button
            type="primary"
            key="reload"
            onClick={() => window.location.reload()}
          >
            {t('errorBoundary.reload')}
          </Button>,
          <Button
            key="home"
            onClick={() => { window.location.href = '/'; }}
          >
            {t('errorBoundary.home')}
          </Button>,
        ]}
      >
        {import.meta.env.DEV && error && <DevErrorDetails error={error} />}
      </Result>
    </div>
  );
}

// Outer: the ErrorBoundary mounts ABOVE App.tsx's ConfigProvider, so
// when it catches we lose the user's dark/light theme — re-apply it
// here from the persisted theme-store before rendering the inner UI.
function ErrorBoundaryUI({ error }: { error: Error | null }) {
  const mode = useThemeStore((s) => s.mode);
  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <ErrorBoundaryInner error={error} />
    </ConfigProvider>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorBoundaryUI error={this.state.error} />;
  }
}
