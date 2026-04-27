import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import { useTranslation } from '@algreen/i18n';
import srRS from 'antd/locale/sr_RS';
import enUS from 'antd/locale/en_US';
import { theme } from './styles/theme';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const antdLocales: Record<string, typeof srRS> = { sr: srRS, en: enUS };

export function App() {
  const { i18n } = useTranslation();
  const { token } = antdTheme.useToken();

  return (
    <ConfigProvider theme={theme} locale={antdLocales[i18n.language] || srRS} form={{ requiredMark: (label, { required }) => <>{label}{required && <span style={{ color: token.colorError, marginLeft: 2 }}>*</span>}</> }}>
      <AntApp notification={{ placement: 'bottomRight' }}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AppRoutes />
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
