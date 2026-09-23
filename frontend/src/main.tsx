import '@ant-design/v5-patch-for-react-19';
import './styles/overrides.css';
import { StrictMode, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { NETWORK_UNREACHABLE_MESSAGE, setNetworkErrorHandler, setUnauthorizedHandler } from './lib/http';
import { silentLogin } from './lib/auth';
import { hogeeDarkTheme, hogeeLightTheme } from './theme';
import { useThemeAttribute, useThemeStore } from './stores/themeStore';

function Root({ loginError }: { loginError: string | null }) {
  const mode = useThemeStore((s) => s.mode);
  useThemeAttribute();
  const theme = useMemo(() => (mode === 'light' ? hogeeLightTheme : hogeeDarkTheme), [mode]);

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <GlobalFeedbackBridge loginError={loginError} />
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

function GlobalFeedbackBridge({ loginError }: { loginError: string | null }) {
  const { message } = AntApp.useApp();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      message.error('登录已失效（401），请重新获取访问令牌');
    });
    setNetworkErrorHandler(() => {
      message.error(NETWORK_UNREACHABLE_MESSAGE);
    });
    return () => {
      setUnauthorizedHandler(null);
      setNetworkErrorHandler(null);
    };
  }, [message]);
  useEffect(() => {
    if (loginError) message.error(`自动登录失败：${loginError}`);
  }, [loginError, message]);
  return null;
}

/** MSW 默认不启动（应用直连真实后端）；设 VITE_ENABLE_MSW=true 时启用浏览器 mock */
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

const LOGIN_TIMEOUT_MS = 10_000;

/** 启动即静默登录（默认账号），失败不阻塞渲染、给出可见错误 */
async function bootstrap(): Promise<string | null> {
  await enableMocking();
  try {
    // 加超时兜底：后端挂起时不让应用白屏，带着占位 token 继续渲染
    await Promise.race([
      silentLogin(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('后端登录接口无响应')), LOGIN_TIMEOUT_MS)),
    ]);
  } catch (err) {
    return err instanceof Error && err.message ? err.message : '未知错误';
  }
  return null;
}

void bootstrap().then((loginError) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root loginError={loginError} />
    </StrictMode>,
  );
});
