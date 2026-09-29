import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logout as clearSession, usernameFromToken } from '../lib/auth';

type AuthState = {
  /**
   * 每次登录/登出自增。token 本身躺在 localStorage 里（`lib/http.ts` 管），不是响应式值，
   * 所以订阅者监听这个计数器来触发重渲染，再自己调 `hasSession()` 取真值。
   */
  revision: number;
  /** 登录账号名，仅用于顶栏展示 */
  username: string | null;
  signIn: (username: string) => void;
  signOut: () => void;
  /** 刷新后把用户名从 token 里补回来（见 lib/auth.ts 的 usernameFromToken） */
  hydrateUsername: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      revision: 0,
      username: null,
      signIn: (username) => set((s) => ({ username, revision: s.revision + 1 })),
      signOut: () => {
        clearSession();
        set((s) => ({ username: null, revision: s.revision + 1 }));
      },
      hydrateUsername: () => {
        if (get().username) return;
        const name = usernameFromToken();
        if (name) set({ username: name });
      },
    }),
    {
      name: 'deepsfv-auth',
      // 只持久化用户名：登录态的真相是 localStorage 里的 token，别在本地再存一份布尔值造成两者漂移
      partialize: (s) => ({ username: s.username }),
    },
  ),
);