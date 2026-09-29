import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasSession } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';

/**
 * 路由守卫：没有 token 就赶回登录页，并记住原地址（登录后跳回去）。
 *
 * 订阅 `revision` 是为了在 401 / 主动登出时重新求值——`hasSession()` 读的是 localStorage，
 * 本身不会触发 React 重渲染。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const revision = useAuthStore((s) => s.revision);
  const location = useLocation();

  // revision 只用于订阅，真值每次都重新读
  void revision;

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}