import { workflowRedirect, workflowStep } from './workflow';

describe('workflowStep（按后端真实状态映射）', () => {
  it('无剧本 → Step 1', () => {
    expect(workflowStep({ hasScripts: false, hasAssets: false })).toBe(1);
  });

  it('有剧本无资产 → Step 2', () => {
    expect(workflowStep({ hasScripts: true, hasAssets: false })).toBe(2);
  });

  it('有剧本有资产 → Step 3', () => {
    expect(workflowStep({ hasScripts: true, hasAssets: true })).toBe(3);
  });

  it('有资产但无剧本 → 仍 Step 1（剧本是前置）', () => {
    expect(workflowStep({ hasScripts: false, hasAssets: true })).toBe(1);
  });
});

describe('workflowRedirect', () => {
  it('无剧本时访问资产页 → 回剧本列表', () => {
    expect(workflowRedirect('proj-1', 1, 'assets')).toBe('/project/proj-1/scripts');
  });

  it('有剧本后放行资产页', () => {
    expect(workflowRedirect('proj-1', 2, 'assets')).toBeNull();
  });

  it('无资产时访问分镜页 → 回资产页', () => {
    expect(workflowRedirect('proj-1', 2, 'episodes')).toBe('/project/proj-1/assets');
  });

  it('无剧本时访问分镜页 → 直接送回剧本页（避免两跳）', () => {
    expect(workflowRedirect('proj-1', 1, 'episodes')).toBe('/project/proj-1/scripts');
    expect(workflowRedirect('proj-1', 1, 'studio')).toBe('/project/proj-1/scripts');
  });

  it('有资产后放行分镜页与工作室', () => {
    expect(workflowRedirect('proj-1', 3, 'episodes')).toBeNull();
    expect(workflowRedirect('proj-1', 3, 'studio')).toBeNull();
  });
});
