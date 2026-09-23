import { apiFetch, setAuthToken } from './http';

export const DEFAULT_USERNAME = 'admin';
export const DEFAULT_PASSWORD = 'admin123';

export type LoginData = {
  token: string;
  name: string;
  id: number;
};

/**
 * 静默自动登录：应用启动时用默认账号换取真实 token（后端返回的 token 带 `Bearer ` 前缀，入库前剥掉）。
 * 正式登录页上线后直接替换这一步。
 */
export async function silentLogin(
  username: string = DEFAULT_USERNAME,
  password: string = DEFAULT_PASSWORD,
): Promise<LoginData> {
  const data = await apiFetch<LoginData>('/api/login/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(data.token.replace(/^Bearer\s+/i, ''));
  return data;
}
