import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Button, Typography, Result, theme } from 'antd';
import { useTranslation } from '@alblue/i18n';

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

// Class component can't use hooks, so the i18n-aware UI lives in this
// child function component. Switching locale re-renders it without
// reloading the page.
function ErrorBoundaryUI({ error }: { error: Error | null }) {
  const { t } = useTranslation('dashboard');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <Result
        status="500"
        title={t('errorBoundary.title')}
        subTitle={t('errorBoundary.subtitle')}
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
