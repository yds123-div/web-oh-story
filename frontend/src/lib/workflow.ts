import type { WorkflowStep } from '../types/api';

export type WorkflowPage = 'scripts' | 'assets' | 'episodes' | 'studio';

/**
 * 门控映射（按后端真实状态字段）：
 * - 有剧本 → 资产可进
 * - 有资产 → 分镜可进
 *
 * 注意：unlockedStep 是后端 workflow 接口返回的值（1=大纲/剧本, 2=资产, 3=分镜）
 * 但 P0 期间简化为：
 * - Step 1（剧本/大纲）：总是可进
 * - Step 2（资产）：需要 Step 1 完成（有剧本）
 * - Step 3（分镜）：需要 Step 2 完成（有资产）
 */
export function workflowRedirect(
  projectId: string,
  unlockedStep: WorkflowStep,
  requested: WorkflowPage,
): string | null {
  if (requested === 'assets' && unlockedStep < 2) {
    return `/project/${projectId}/scripts`;
  }
  if (requested === 'episodes' && unlockedStep < 3) {
    return `/project/${projectId}/assets`;
  }
  if (requested === 'studio' && unlockedStep < 3) {
    return `/project/${projectId}/episodes`;
  }
  return null;
}
