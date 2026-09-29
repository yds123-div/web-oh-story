import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'dark' | 'light';

type ThemeState = {
  mode: ColorMode;
  toggle: () => void;
  /** 直接指定主题（设置中心的外观面板用；顶栏用的 toggle 是它的二态简化） */
  setMode: (mode: ColorMode) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // 亮色是设计基线（借鉴 Toonflow 后的新外观）；暗色仍可通过顶栏开关切换
      mode: 'light',
      toggle: () => set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'deepsfv-theme',
      // v0 存的是旧默认值 'dark'。基线改成亮色后做一次性重置：持久化状态里无法区分
      // "用户主动选的暗色"与"从没动过、沿用旧默认值"，所以统一回到亮色，
      // 让老用户也能看到新界面（想暗色再点一次开关即可）。
      version: 1,
      migrate: () => ({ mode: 'light' as ColorMode }),
    },
  ),
);

export function useThemeAttribute(): void {
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);
}
