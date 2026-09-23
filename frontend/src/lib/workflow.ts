import type { WorkflowStep } from '../types/api';

export type WorkflowPage = 'scripts' | 'assets' | 'episodes' | 'studio';

/** 门控数据源（按后端真实状态查询） */
export type WorkflowProgress = {
  hasScripts: boolean;
  hasAssets: boolean;
};

/**
 * 三步门控（按后端真实状态字段映射）：
 * - Step 1（剧本列表）：总是可进
 * - Step 2（资产）：有剧本 → 可进
 * - Step 3（分镜/工作室）：有剧本且有资产 → 可进
 */
export function workflowStep(progress: WorkflowProgress): WorkflowStep {
  if (progress.hasScripts && progress.hasAssets) return 3;
  if (progress.hasScripts) return 2;
  return 1;
}

export function workflowRedirect(
  projectId: string,
  unlockedStep: WorkflowStep,
  requested: WorkflowPage,
): string | null {
  if (requested === 'assets' && unlockedStep < 2) {
    return `/project/${projectId}/scripts`;
  }
  if ((requested === 'episodes' || requested === 'studio') && unlockedStep < 3) {
    // 无剧本直接送回剧本页，避免"资产页→剧本页"的两跳
    return unlockedStep < 2
      ? `/project/${projectId}/scripts`
      : `/project/${projectId}/assets`;
  }
  return null;
}
