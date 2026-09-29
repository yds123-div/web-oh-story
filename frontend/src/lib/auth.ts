import { apiFetch, clearAuthToken, getAuthToken, setAuthToken } from './http';

export type LoginData = {
  /** 后端返回的 token 带 `Bearer ` 前缀，入库前剥掉 */
  token: string;
  name: string;
  id: number;
};

/**
 * 登录。
 *
 * 此前这里叫 `silentLogin()`：默认管理员的账号与口令被**硬编码在包里**，并在启动时自动调用。
 * 那等于把凭据随前端一起公开发布（本仓库还是 public），任何能打开页面的人自动就是管理员，
 * JWT 再严也白搭。现在改为用户在登录页显式提交，本模块里不再出现任何凭据字面量。
 */
export async function login(username: string, password: string): Promise<LoginData> {
  const data = await apiFetch<LoginData>('/api/login/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthToken(data.token.replace(/^Bearer\s+/i, ''));
  return data;
}

/** 当前是否持有 token（只代表"有"，有效性由后端 401 兜底） */
export function hasSession(): boolean {
  return getAuthToken().length > 0;
}

/**
 * 从 JWT 载荷里取出账号名。
 *
 * 用途：刷新页面后 token 还在、但"用户是谁"只记在内存里，顶栏会显示不出来。
 * 自己签发的 token 里就带着 `{ id, name }`，解出来即可，不必为此多打一次接口
 * （`loginConfig/getUser` 还在设置中心口令门后面，本来也不该在这里调）。
 */
export function usernameFromToken(token = getAuthToken()): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { name?: unknown };
    return typeof json.name === 'string' && json.name ? json.name : null;
  } catch {
    // 结构不对就当作取不到，不阻断界面
    return null;
  }
}

/** 退出登录：清掉 token 与本标签页的设置中心口令 */
export function logout(): void {
  clearAuthToken();
  try {
    sessionStorage.removeItem('deepsfv-settings-key');
  } catch {
    // sessionStorage 不可用时忽略
  }
}