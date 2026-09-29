import '@ant-design/v5-patch-for-react-19';
import './styles/overrides.css';
import { StrictMode, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { NETWORK_UNREACHABLE_MESSAGE, setNetworkErrorHandler, setUnauthorizedHandler } from './lib/http';
import { hogeeDarkTheme, hogeeLightTheme } from './theme';
import { useAuthStore } from './stores/authStore';
import { useThemeAttribute, useThemeStore } from './stores/themeStore';

function Root() {
  const mode = useThemeStore((s) => s.mode);
  useThemeAttribute();
  const theme = useMemo(() => (mode === 'light' ? hogeeLightTheme : hogeeDarkTheme), [mode]);

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp>
        <GlobalFeedbackBridge />
        <App />
      </AntApp>
    </ConfigProvider>
  );
}

function GlobalFeedbackBridge() {
  const { message } = AntApp.useApp();
  const signOut = useAuthStore((s) => s.signOut);
  const hydrateUsername = useAuthStore((s) => s.hydrateUsername);
  // 刷新页面后 token 还在但用户名丢了，从 JWT 载荷里补回来（否则顶栏只能显示"?"）
  useEffect(() => {
    hydrateUsername();
  }, [hydrateUsername]);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // token 过期/失效：清会话 → RequireAuth 重新求值 → 自动回登录页
      signOut();
      message.error('登录已失效，请重新登录');
    });
    setNetworkErrorHandler(() => {
      message.error(NETWORK_UNREACHABLE_MESSAGE);
    });
    return () => {
      setUnauthorizedHandler(null);
      setNetworkErrorHandler(null);
    };
  }, [message, signOut]);
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

/**
 * 启动只做 mock 初始化，不再自动登录。
 *
 * 以前这里会静默用硬编码的 admin/admin123 换 token——那让"未登录"永远不存在，
 * 也把凭据随前端一起公开发布。现在未登录就由 RequireAuth 送去 /login，由用户显式提交。
 */
async function bootstrap(): Promise<void> {
  await enableMocking();
}

void bootstrap().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
});
