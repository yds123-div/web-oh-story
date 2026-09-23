const RECENT_PROJECT_KEY = 'deepsfv-recent-project';

/** 记录最近访问的项目（进入 /project/:id/* 工作流页面时写入） */
export function setRecentProjectId(id: string): void {
  try {
    localStorage.setItem(RECENT_PROJECT_KEY, id);
  } catch {
    // localStorage 不可用时静默降级
  }
}

/** 读取最近访问的项目 id；未记录或不可用时返回 null */
export function getRecentProjectId(): string | null {
  try {
    return localStorage.getItem(RECENT_PROJECT_KEY);
  } catch {
    return null;
  }
}
