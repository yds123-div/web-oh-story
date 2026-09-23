import { apiFetch, setAuthToken } from './http';

export type LoginData = {
  token: string;
  name: string;
  id: number;
};

/**
 * 静默自动登录：应用启动时用默认账号（admin/admin123）换取真实 token
 * （后端返回的 token 带 `Bearer ` 前缀，入库前剥掉）。正式登录页上线后直接替换这一步。
 */
export async function silentLogin(): Promise<LoginData> {
  const data = await apiFetch<LoginData>('/api/login/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  setAuthToken(data.token.replace(/^Bearer\s+/i, ''));
  return data;
}
