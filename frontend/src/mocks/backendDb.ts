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

/** 后端 `o_assets` 表一行 */
export type BackendAssetRow = {
  id: number;
  /** 父资产 id（子资产/多形象），父资产为 null */
  assetsId: number | null;
  projectId: number;
  name: string;
  describe: string;
  type: 'role' | 'scene' | 'tool';
  prompt: string | null;
  remark: string | null;
  imageId: number | null;
  startTime: number;
};

/** 后端 `o_image` 表一行（mock 用 dataUrl 直接充当静态托管 URL） */
type BackendImageRow = {
  id: number;
  assetsId: number;
  filePath: string;
  type: string;
  state: string;
  /** 上传图片的 data URL（真实后端写文件后返回 oss URL） */
  dataUrl?: string;
};

/** 种子项目 id（数字，与后端一致） */
export const DEMO_PROJECT_ID = 1758000000000;
export const DEMO_PROJECT_NAME = '逆命木叶';

let projects: BackendProjectRow[] = [];
let tasks: BackendTaskRow[] = [];
let scripts: BackendScriptRow[] = [];
let assets: BackendAssetRow[] = [];
let images: BackendImageRow[] = [];
let imageIdSeq = 1;
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
  assets = [
    {
      id: 101,
      assetsId: null,
      projectId: DEMO_PROJECT_ID,
      name: '林晚',
      describe: '现代穿越者，成为木叶孤女，知晓结局试图拯救鼬，却陷入权力旋涡。',
      type: 'role',
      prompt: null,
      remark: null,
      imageId: null,
      startTime: 1758000060000,
    },
    {
      id: 102,
      assetsId: null,
      projectId: DEMO_PROJECT_ID,
      name: '宇智波鼬',
      describe: '背负灭族悲剧的忍者，心思深沉，因任务与宿命被迫推开林晚。',
      type: 'role',
      prompt: null,
      remark: null,
      imageId: null,
      startTime: 1758000061000,
    },
    {
      id: 103,
      assetsId: null,
      projectId: DEMO_PROJECT_ID,
      name: '木叶长廊',
      describe: '传统日式木质长廊，林晚与鼬深夜对峙的场所（月夜冷调）。',
      type: 'scene',
      prompt: null,
      remark: null,
      imageId: null,
      startTime: 1758000062000,
    },
  ];
  images = [];
  imageIdSeq = 1;
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

// ===== 资产（复刻后端 o_assets / o_image 契约）=====

/** 镜像后端 getAllAssets：项目全部父资产（排除 clip/audio，本 mock 无这两类） */
export function getBackendAssets(projectId: number): BackendAssetRow[] {
  return assets.filter((a) => a.projectId === projectId && a.assetsId == null).map((a) => ({ ...a }));
}

/** 镜像后端 addAssets：不返回 id，只写库 */
export function addBackendAsset(
  row: Pick<BackendAssetRow, 'projectId' | 'name' | 'describe' | 'type'> &
    Partial<Pick<BackendAssetRow, 'prompt' | 'remark'>>,
): BackendAssetRow {
  const created: BackendAssetRow = {
    assetsId: null,
    prompt: null,
    remark: null,
    imageId: null,
    startTime: Date.now(),
    ...row,
    id: Date.now() + assets.length,
  };
  assets.push(created);
  return { ...created };
}

/** AI 提取状态机批量建资产（委托 addBackendAsset，describe 置空） */
export function addBackendAssets(
  rows: Array<Pick<BackendAssetRow, 'projectId' | 'name' | 'type'>>,
): BackendAssetRow[] {
  return rows.map((row) => addBackendAsset({ ...row, describe: '' }));
}

/** 镜像后端 updateAssets：name/describe/remark/prompt 全量覆盖 */
export function updateBackendAsset(
  id: number,
  patch: Pick<BackendAssetRow, 'name' | 'describe'> &
    Partial<Pick<BackendAssetRow, 'remark' | 'prompt'>>,
): BackendAssetRow | null {
  const found = assets.find((a) => a.id === id);
  if (!found) return null;
  Object.assign(found, patch);
  return { ...found };
}

/** 镜像后端 delAssets：级联删 o_image 与子资产 */
export function deleteBackendAsset(id: number): void {
  images = images.filter((img) => img.assetsId !== id);
  assets = assets.filter((a) => a.id !== id && a.assetsId !== id);
}

/**
 * 镜像后端 saveAssets：
 * - 有 base64：写"文件"、插 o_image、把资产 imageId 指过去
 * - 无 base64（真实后端允许的 prompt-only 更新）：只更新 prompt 与 imageId
 */
export function saveBackendAssetImage(body: {
  assetId: number;
  base64?: string | null;
  type: string;
  prompt?: string | null;
  imageId?: number | null;
}): void {
  const found = assets.find((a) => a.id === body.assetId);
  if (!found) return;
  if (!body.base64) {
    found.prompt = body.prompt ?? '';
    if (body.imageId != null) found.imageId = body.imageId;
    return;
  }
  const created: BackendImageRow = {
    id: imageIdSeq++,
    assetsId: body.assetId,
    filePath: `/${found.projectId}/${body.type}/mock-${Date.now()}.png`,
    type: body.type,
    state: '已完成',
    dataUrl: body.base64,
  };
  images.push(created);
  found.imageId = created.id;
  found.prompt = body.prompt ?? '';
}

/** o_image 行 → 静态托管 URL（真实后端 oss 路径；mock 上传图直接回 data URL 以便展示） */
function imageSrc(row: BackendAssetRow): string | null {
  if (row.imageId == null) return null;
  const image = images.find((img) => img.id === row.imageId);
  if (!image) return null;
  return image.dataUrl ?? `http://localhost:10588/oss${image.filePath}`;
}

export type BackendAssetPageRow = BackendAssetRow & {
  filePath: string | null;
  state: string | null;
  src: string | null;
  sonAssets: unknown[];
};

/** 镜像后端 getAssetsApi：父资产分页 + join 图片，子资产挂 sonAssets */
export function getBackendAssetPage(
  projectId: number,
  type: string,
  name: string | undefined,
  page: number,
  limit: number,
): { data: BackendAssetPageRow[]; total: number } {
  const matches = assets
    .filter((a) => a.projectId === projectId)
    .filter((a) => a.type === type)
    .filter((a) => (name ? a.name.includes(name) : true));
  const parents = matches.filter((a) => a.assetsId == null);
  const children = matches.filter((a) => a.assetsId != null);
  const image = (a: BackendAssetRow) => images.find((img) => img.id === a.imageId);
  const data = parents
    .slice((page - 1) * limit, page * limit)
    .map((parent) => ({
      ...parent,
      filePath: image(parent)?.filePath ?? null,
      state: image(parent)?.state ?? null,
      src: imageSrc(parent),
      sonAssets: children
        .filter((child) => child.assetsId === parent.id)
        .map((child) => ({ ...child, src: imageSrc(child) })),
    }));
  return { data, total: parents.length };
}

