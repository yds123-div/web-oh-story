/**
 * 后端形状的内存库（o_project / o_tasks / o_script / o_assets），供 MSW 按后端真实契约模拟：
 * POST + JSON body + `{code, data, message}` 信封；id 为 number。
 * 仅用于测试与浏览器 mock，与真实后端无关。
 */

import type { ProjectStatistics } from '../types/api';
import { EXTRACT_STATE } from '../lib/extractState';

export type BackendProjectRow = {
  id: number;
  projectType: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string;
  directorManual: string;
  videoRatio: string;
  imageModel: string;
  videoModel: string;
  imageQuality: string;
  mode: string;
  createTime: number;
  userId: number;
};

export type BackendTaskRow = {
  id: number;
  projectId: number | null;
  taskClass: string;
  relatedObjects: string | null;
  model: string | null;
  describe: string;
  state: string;
  startTime: number;
  reason: string | null;
};

/** 后端 `o_script` 表一行（id 为自增 number，与真实后端一致） */
export type BackendScriptRow = {
  id: number;
  projectId: number;
  name: string;
  content: string;
  /** null=未提取（手动新增不写该列）、2=等待提取、0=正在提取、1=成功、-1=失败 */
  extractState: number | null;
  errorReason: string | null;
  createTime: number;
};

/** 后端 `o_assets` 表一行（仅模拟门控所需的字段） */
export type BackendAssetRow = {
  id: number;
  projectId: number;
  name: string;
  type: 'role' | 'scene' | 'tool';
};

/** 种子项目 id（数字，与后端一致） */
export const DEMO_PROJECT_ID = 1758000000000;
export const DEMO_PROJECT_NAME = '逆命木叶';

let projects: BackendProjectRow[] = [];
let tasks: BackendTaskRow[] = [];
let scripts: BackendScriptRow[] = [];
let assets: BackendAssetRow[] = [];
/** generalStatistics 的模拟计数（真实后端按 o_assets/o_script 等表统计） */
let statsByProject = new Map<number, ProjectStatistics>();
/** o_script 自增 id 计数器（与真实后端一致，非时间戳） */
let scriptIdSeq = 1;
/** 异步状态机的待触发定时器：reset 时必须清理，防止残留回调污染下一个用例 */
let pendingTimers: ReturnType<typeof setTimeout>[] = [];

function schedule(ms: number, fn: () => void): void {
  pendingTimers.push(setTimeout(fn, ms));
}

function seed(): void {
  for (const timer of pendingTimers) clearTimeout(timer);
  pendingTimers = [];
  scriptIdSeq = 1;
  projects = [
    {
      id: DEMO_PROJECT_ID,
      projectType: 'script',
      name: DEMO_PROJECT_NAME,
      intro: '知晓结局的穿越者试图改写宿命',
      type: '女频-轻小说',
      artStyle: '赛博朋克电影',
      directorManual: '',
      videoRatio: '9:16',
      imageModel: 'Seedream-4.0',
      videoModel: 'Seedance 2.0',
      imageQuality: '2K',
      mode: 'text',
      createTime: 1758000000000,
      userId: 1,
    },
  ];
  tasks = [
    {
      id: 9001,
      projectId: DEMO_PROJECT_ID,
      taskClass: '剧本资产提取',
      relatedObjects: '{"scriptId":12}',
      model: 'deepseek-chat',
      describe: '提取《逆命木叶》第 1 集资产',
      state: '生成失败',
      startTime: 1758000100000,
      reason: '供应商未配置 key',
    },
    {
      id: 9002,
      projectId: DEMO_PROJECT_ID,
      taskClass: '视频生成',
      relatedObjects: '{"storyboardId":33}',
      model: 'Seedance 2.0',
      describe: '生成分镜 33 的视频',
      state: '已完成',
      startTime: 1758000200000,
      reason: null,
    },
    {
      id: 9003,
      projectId: null,
      taskClass: '分镜图片生成',
      relatedObjects: null,
      model: 'Seedream-4.0',
      describe: '系统维护前的遗留任务',
      state: '进行中',
      startTime: 1758000300000,
      reason: null,
    },
  ];
  scripts = [
    {
      id: scriptIdSeq++,
      projectId: DEMO_PROJECT_ID,
      name: '第1集·异世囚笼',
      content: '【木叶长廊 内 夜】\n木叶，夜晚长廊，月光冷白。\n△ 林晚扶着廊柱，指尖颤抖，眼神茫然又痛苦。\n鼬：深夜在此，有何目的。',
      extractState: null,
      errorReason: null,
      createTime: 1758000050000,
    },
  ];
  assets = [];
  statsByProject = new Map([
    [DEMO_PROJECT_ID, { roleCount: 2, scriptCount: 1, videoCount: 0, storyboardCount: 3 }],
  ]);
}

seed();

export function resetBackendDb(): void {
  seed();
}

export function getBackendProjects(): BackendProjectRow[] {
  return projects.map((p) => ({ ...p }));
}

export function findBackendProject(id: number): BackendProjectRow | null {
  const found = projects.find((p) => p.id === id);
  return found ? { ...found } : null;
}

export function addBackendProject(row: Omit<BackendProjectRow, 'id' | 'createTime' | 'userId'>): BackendProjectRow {
  const created: BackendProjectRow = { ...row, id: Date.now(), createTime: Date.now(), userId: 1 };
  projects.push(created);
  return created;
}

export function updateBackendProject(id: number, patch: Partial<BackendProjectRow>): BackendProjectRow | null {
  const found = projects.find((p) => p.id === id);
  if (!found) return null;
  Object.assign(found, patch);
  return { ...found };
}

export function deleteBackendProject(id: number): void {
  // 后端 delProject 级联删除任务
  projects = projects.filter((p) => p.id !== id);
  tasks = tasks.filter((t) => t.projectId !== id);
  statsByProject.delete(id);
}

export function getBackendTasks(): BackendTaskRow[] {
  return tasks.map((t) => ({ ...t }));
}

export function getBackendTaskById(id: number): BackendTaskRow | null {
  const found = tasks.find((t) => t.id === id);
  return found ? { ...found } : null;
}

export function setProjectStatistics(projectId: number, counts: ProjectStatistics): void {
  statsByProject.set(projectId, counts);
}

export function getProjectStatistics(projectId: number): ProjectStatistics {
  return statsByProject.get(projectId) ?? { roleCount: 0, scriptCount: 0, videoCount: 0, storyboardCount: 0 };
}

// ===== 剧本（复刻后端 o_script 契约）=====

/** 镜像后端 getScrptApi 返回：每行带 relatedAssets（后端 leftJoin o_scriptAssets，无关联时为 []） */
export function getBackendScripts(
  projectId: number,
  name?: string,
): (BackendScriptRow & { relatedAssets: { id: number; name: string }[] })[] {
  return scripts
    .filter((s) => s.projectId === projectId)
    .filter((s) => (name ? s.name.includes(name) : true))
    .map((s) => ({ ...s, relatedAssets: [] }));
}

export function addBackendScript(row: Pick<BackendScriptRow, 'projectId' | 'name' | 'content'>): BackendScriptRow {
  // 真实后端 addScript 不写 extractState（NULL）且不返回 id
  const created: BackendScriptRow = {
    ...row,
    id: scriptIdSeq++,
    extractState: null,
    errorReason: null,
    createTime: Date.now(),
  };
  scripts.push(created);
  return { ...created };
}

export function updateBackendScript(
  id: number,
  patch: Pick<BackendScriptRow, 'name' | 'content'>,
): BackendScriptRow | null {
  const found = scripts.find((s) => s.id === id);
  if (!found) return null;
  Object.assign(found, patch);
  return { ...found };
}

export function deleteBackendScripts(ids: number[]): void {
  scripts = scripts.filter((s) => !ids.includes(s.id));
}

/** 批量更新提取状态（镜像后端 extractAssets 异步各阶段的 update） */
export function setBackendScriptExtractState(
  ids: number[],
  extractState: number | null,
  errorReason: string | null = null,
): void {
  for (const script of scripts) {
    if (ids.includes(script.id)) {
      script.extractState = extractState;
      script.errorReason = errorReason;
    }
  }
}

/**
 * 镜像后端异步提取的完整状态机：等待 → 提取中 → 成功（模拟 LLM 写入资产）
 * / 失败（failReason 有值）。定时器注册登记，reset 时统一清理。
 */
export function runExtractStateMachine(
  projectId: number,
  ids: number[],
  options: { failReason?: string } = {},
): void {
  setBackendScriptExtractState(ids, EXTRACT_STATE.WAITING);
  schedule(200, () => {
    setBackendScriptExtractState(ids, EXTRACT_STATE.EXTRACTING);
    schedule(200, () => {
      if (options.failReason) {
        setBackendScriptExtractState(ids, EXTRACT_STATE.FAILED, options.failReason);
        return;
      }
      // 种子剧本内容是「林晚」片段，模拟真实提取出的角色资产（同名不重复插入）
      const existingNames = new Set(getBackendAssets(projectId).map((a) => a.name));
      const extracted = [{ projectId, name: '林晚', type: 'role' as const }].filter(
        (a) => !existingNames.has(a.name),
      );
      if (extracted.length) addBackendAssets(extracted);
      setBackendScriptExtractState(ids, EXTRACT_STATE.DONE);
    });
  });
}

/** 轮询镜像后端 pollScriptAssets：只回 id/extractState/errorReason */
export function getBackendScriptStates(
  ids: number[],
): { id: number; extractState: number | null; errorReason: string | null }[] {
  return scripts
    .filter((s) => ids.includes(s.id))
    .map((s) => ({ id: s.id, extractState: s.extractState, errorReason: s.errorReason }));
}

// ===== 资产（仅模拟门控所需的 getAllAssets）=====

export function getBackendAssets(projectId: number): BackendAssetRow[] {
  return assets.filter((a) => a.projectId === projectId).map((a) => ({ ...a }));
}

export function addBackendAssets(rows: Omit<BackendAssetRow, 'id'>[]): void {
  for (const row of rows) assets.push({ ...row, id: Date.now() + assets.length });
}
