/**
 * 后端形状的内存库（o_project / o_tasks / o_script / o_assets），供 MSW 按后端真实契约模拟：
 * POST + JSON body + `{code, data, message}` 信封；id 为 number。
 * 仅用于测试与浏览器 mock，与真实后端无关。
 */

import type { ProjectStatistics } from '../types/api';
import { EXTRACT_STATE } from '../lib/extractState';
import { IMAGE_STATE, PROMPT_STATE } from '../lib/assetGenState';
import { STORYBOARD_IMAGE_STATE, VIDEO_PROMPT_STATE, VIDEO_STATE } from '../lib/videoGenState';

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
  /** 提示词润色状态（后端中文文案：生成中/已完成/失败/生成失败），NULL=从未润色 */
  promptState: string | null;
  /** 润色失败原因 */
  promptErrorReason: string | null;
  startTime: number;
};

/** 后端 `o_image` 表一行（mock 用 dataUrl 直接充当静态托管 URL） */
type BackendImageRow = {
  id: number;
  assetsId: number;
  filePath: string;
  type: string;
  state: string;
  /** 生图失败原因（真实后端 o_image.errorReason，父资产查询不返回该列） */
  errorReason: string | null;
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
let storyboards: BackendStoryboardRow[] = [];
let tracks: BackendTrackRow[] = [];
let videos: BackendVideoRow[] = [];
/** o_storyboard 自增 id 计数器（与真实后端的 rowid 自增一致） */
let storyboardIdSeq = 1;
/** o_videoTrack id 计数器（真实后端用 Date.now()，mock 用递增避免同毫秒撞号） */
let trackIdSeq = 1;
/** o_video id 计数器 */
let videoIdSeq = 1;
/** 视频供应商 key 开关：镜像真实后端「未配置时视频生成必失败」的默认态 */
let videoVendorEnabled = false;
/**
 * 视频提示词生成的失败开关。默认 null：文本模型 key 已配好（09 的前置条件），
 * 提示词生成应当成功。测试置为原因字符串即可验证失败态展示。
 */
let videoPromptFailReason: string | null = null;
/** 图像供应商 key 开关：镜像真实后端「key 未配置时生图必失败」的默认态 */
let imageVendorEnabled = false;
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
      promptState: null,
      promptErrorReason: null,
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
      promptState: null,
      promptErrorReason: null,
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
      promptState: null,
      promptErrorReason: null,
      startTime: 1758000062000,
    },
  ];
  images = [];
  imageIdSeq = 1;
  imageVendorEnabled = false;
  // 种子分镜：覆盖「有缩略图 / 无缩略图」与「有关联资产 / 无关联资产」四种展示分支。
  // 每条同事务带一条 o_videoTrack（镜像后端 addStoryboard 的行为）。
  storyboardIdSeq = 1;
  trackIdSeq = 1;
  videoIdSeq = 1;
  videoVendorEnabled = false;
  videoPromptFailReason = null;
  tracks = [];
  videos = [];
  const seedStoryboards: Omit<BackendStoryboardRow, 'id' | 'trackId'>[] = [
    {
      scriptId: 1,
      projectId: DEMO_PROJECT_ID,
      prompt: '长廊夜景：林晚独自伫立，月光透过木窗洒下',
      videoDesc: '长廊夜景：林晚独自伫立，月光透过木窗洒下',
      duration: 4,
      state: STORYBOARD_IMAGE_STATE.NONE,
      reason: null,
      filePath: '',
      shouldGenerateImage: 0,
      associateAssetsIds: [101, 103],
      createTime: 1758000070000,
    },
    {
      scriptId: 1,
      projectId: DEMO_PROJECT_ID,
      prompt: '林晚回头，叫住长廊尽头经过的宇智波鼬',
      videoDesc: '林晚回头，叫住长廊尽头经过的宇智波鼬',
      duration: 3,
      state: STORYBOARD_IMAGE_STATE.NONE,
      reason: null,
      filePath: '/1/storyboard/mock-2.png',
      shouldGenerateImage: 1,
      associateAssetsIds: [101, 102],
      createTime: 1758000071000,
    },
    {
      scriptId: 1,
      projectId: DEMO_PROJECT_ID,
      prompt: '两人对视，鼬神色冷漠，林晚欲言又止',
      videoDesc: '两人对视，鼬神色冷漠，林晚欲言又止',
      duration: 5,
      state: STORYBOARD_IMAGE_STATE.NONE,
      reason: null,
      filePath: '',
      shouldGenerateImage: 0,
      associateAssetsIds: [],
      createTime: 1758000072000,
    },
  ];
  storyboards = seedStoryboards.map((row) => {
    const track = createTrack(DEMO_PROJECT_ID, row.scriptId, row.duration);
    return { ...row, id: storyboardIdSeq++, trackId: track.id };
  });
  statsByProject = new Map([
    [DEMO_PROJECT_ID, { roleCount: 2, scriptCount: 1, videoCount: 0, storyboardCount: 3 }],
  ]);
}

/** 建一条 o_videoTrack（addStoryboard 与 addTrack 共用） */
function createTrack(projectId: number, scriptId: number, duration: number | null): BackendTrackRow {
  const created: BackendTrackRow = {
    id: trackIdSeq++,
    projectId,
    scriptId,
    duration,
    prompt: null,
    state: null,
    reason: null,
    videoId: null,
  };
  tracks.push(created);
  return created;
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
    promptState: null,
    promptErrorReason: null,
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
    state: IMAGE_STATE.DONE,
    errorReason: null,
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


// ===== 资产 AI：润色与生图（复刻后端 assetsGenerate 行为）=====

/** 图像供应商 key 开关（真实后端配置 key 后生图即可用） */
export function setBackendImageVendorEnabled(enabled: boolean): void {
  imageVendorEnabled = enabled;
}

/** 按资产行 id 找到可变引用（内部状态机用） */
function findAssetMut(id: number): BackendAssetRow | undefined {
  return assets.find((a) => a.id === id);
}

/** 批量设置润色状态（镜像后端 polishAssetsPrompt / batchPolishAssetsPrompt 的 update） */
function setAssetsPromptState(ids: number[], promptState: string | null, promptErrorReason: string | null = null): void {
  for (const asset of assets) {
    if (ids.includes(asset.id)) {
      asset.promptState = promptState;
      asset.promptErrorReason = promptErrorReason;
    }
  }
}

/** 单个润色完成后的假提示词（镜像后端文本模型产出写回 o_assets.prompt） */
function fakePolishedPrompt(name: string): string {
  return `【${name}】赛博朋克电影质感：高对比冷调光影，清冷月光，标准四视图，细节锐利。`;
}

/**
 * 镜像后端批量润色异步状态机：受理时置「生成中」并立即返回，
 * 定时器到点写「已完成」+ 假提示词（failReason 有值则写「生成失败」）。
 */
export function runBatchPolishStateMachine(
  ids: number[],
  options: { failReason?: string } = {},
): void {
  setAssetsPromptState(ids, PROMPT_STATE.RUNNING);
  schedule(200, () => {
    for (const id of ids) {
      const asset = findAssetMut(id);
      if (!asset) continue;
      if (options.failReason) {
        asset.promptState = PROMPT_STATE.FAILED_ALT;
        asset.promptErrorReason = options.failReason;
        continue;
      }
      asset.prompt = fakePolishedPrompt(asset.name);
      asset.promptState = PROMPT_STATE.DONE;
      asset.promptErrorReason = null;
    }
  });
}

/** 单个润色（同步）：直接写「已完成」+ 假提示词，返回给调用方（镜像后端同步返回 prompt） */
export function runSinglePolish(id: number): string | null {
  const asset = findAssetMut(id);
  if (!asset) return null;
  asset.prompt = fakePolishedPrompt(asset.name);
  asset.promptState = PROMPT_STATE.DONE;
  asset.promptErrorReason = null;
  return asset.prompt;
}

/**
 * 镜像后端 generateAssets（同步接口）：
 * - 先插 o_image「生成中」占位并挂到资产（真实后端在任何失败下也会保留该行）
 * - 图像供应商已配置 key：置「已完成」并写 filePath，返回小图 URL
 * - 未配置 key（默认）：置「生成失败」+ errorReason，返回携带原因的失败信封
 */
export function runAssetImageGeneration(body: {
  assetId: number;
  type: string;
  model: string;
  resolution: string;
}): { ok: true; path: string } | { ok: false; reason: string } {
  const asset = findAssetMut(body.assetId);
  if (!asset) return { ok: false, reason: '资产不存在' };
  const created: BackendImageRow = {
    id: imageIdSeq++,
    assetsId: body.assetId,
    filePath: `/${asset.projectId}/${body.type}/ai-${Date.now()}.jpg`,
    type: body.type,
    state: IMAGE_STATE.RUNNING,
    errorReason: null,
  };
  images.push(created);
  asset.imageId = created.id;

  if (!imageVendorEnabled) {
    created.state = IMAGE_STATE.FAILED;
    created.errorReason = '图像供应商未配置 key';
    return { ok: false, reason: '图像供应商未配置 key' };
  }
  created.state = IMAGE_STATE.DONE;
  return { ok: true, path: `http://localhost:10588/oss${created.filePath}` };
}

/** 镜像后端 cancelGenerate：把进行中的 o_image 行置「生成失败」 */
export function cancelBackendImage(imageId: number): boolean {
  const image = images.find((img) => img.id === imageId);
  if (!image) return false;
  image.state = IMAGE_STATE.FAILED;
  return true;
}

// ===== 分镜（复刻后端 o_storyboard / o_assets2Storyboard 契约）=====

/** 后端 `o_storyboard` 表一行（id 为全局 rowid 自增，与真实后端一致） */
export type BackendStoryboardRow = {
  id: number;
  scriptId: number;
  projectId: number;
  /** 分镜描述（后端无「景别/运镜」列，两者由页面拼进该文本） */
  prompt: string;
  /** 视频提示词生成的核心输入（09 用）；本 mock 与 prompt 同值 */
  videoDesc: string;
  duration: number;
  /** 未生成 / 生成中 / 已完成 / 生成失败 */
  state: string;
  /** 生图失败原因（后端 o_storyboard.reason） */
  reason: string | null;
  /** 后端静态托管的原图路径；无图为空串 */
  filePath: string;
  /** 同事务创建的 o_videoTrack id（后端 addStoryboard 一镜一轨） */
  trackId: number | null;
  shouldGenerateImage: number;
  /** 关联资产 id（o_assets2Storyboard 的行） */
  associateAssetsIds: number[];
  createTime: number;
};

/** 后端 `o_videoTrack` 表一行 */
export type BackendTrackRow = {
  id: number;
  projectId: number;
  scriptId: number;
  duration: number | null;
  /** AI 生成的视频提示词 */
  prompt: string | null;
  /** NULL=从未生成 / 生成中 / 已完成 / 生成失败 */
  state: string | null;
  /** 提示词生成失败原因 */
  reason: string | null;
  /** 当前选中的视频版本（后端列名 videoId；未选择为 null） */
  videoId: number | null;
};

/** 后端 `o_video` 表一行 */
export type BackendVideoRow = {
  id: number;
  projectId: number;
  scriptId: number;
  videoTrackId: number;
  filePath: string;
  /** 生成中 / 生成成功 / 生成失败 */
  state: string;
  errorReason: string | null;
  time: number;
};

/** 镜像后端 getStoryboardData：按 scriptId + projectId 查，index 全为 NULL 时按 id 升序（= 插入顺序） */
export function getBackendStoryboards(projectId: number, scriptId: number): BackendStoryboardRow[] {
  return storyboards
    .filter((s) => s.scriptId === scriptId && s.projectId === projectId)
    .sort((a, b) => a.id - b.id)
    .map((s) => ({ ...s, associateAssetsIds: [...s.associateAssetsIds] }));
}

/** 镜像后端 addStoryboard：同事务建 o_videoTrack，返回新分镜 id */
export function addBackendStoryboard(row: {
  scriptId: number;
  projectId: number;
  prompt: string;
  videoDesc: string;
  duration: number;
  state: string;
  shouldGenerateImage: number;
}): number {
  const track = createTrack(row.projectId, row.scriptId, null);
  const created: BackendStoryboardRow = {
    ...row,
    id: storyboardIdSeq++,
    reason: null,
    filePath: '',
    trackId: track.id,
    associateAssetsIds: [],
    createTime: Date.now(),
  };
  storyboards.push(created);
  return created.id;
}

/** 镜像后端 editStoryboardInfo：prompt 与 videoDesc 整行覆盖 */
export function updateBackendStoryboard(
  id: number,
  patch: { prompt: string; videoDesc: string },
): boolean {
  const found = storyboards.find((s) => s.id === id);
  if (!found) return false;
  found.prompt = patch.prompt;
  found.videoDesc = patch.videoDesc;
  return true;
}

/**
 * 镜像后端 removeFrame：删分镜与 o_assets2Storyboard 关联。
 *
 * **刻意不删 o_videoTrack** —— 这是实测出来的后端真实行为：removeFrame 只在
 * 「该 track 名下只有这一条分镜」时才删轨道，而它的判断依据是 `o_storyboard.track`
 * 这一列（按 track 名分组），addStoryboard 建的分镜这列恒为 NULL，
 * 于是 `where("track", null)` 会命中该剧本下**所有**分镜，计数永远不等于 1，
 * 轨道就留下来了。实测：删掉 3 条分镜之一后轨道数仍是 3。
 */
export function deleteBackendStoryboard(id: number): boolean {
  const before = storyboards.length;
  storyboards = storyboards.filter((s) => s.id !== id);
  return storyboards.length < before;
}

/** 镜像后端 batchDelete：按 projectId 过滤后批量删；返回实际命中数 */
export function deleteBackendStoryboards(ids: number[], projectId: number): number {
  const matched = storyboards.filter((s) => ids.includes(s.id) && s.projectId === projectId);
  storyboards = storyboards.filter((s) => !matched.some((m) => m.id === s.id));
  return matched.length;
}

/** 分镜关联的资产（getStoryboardData 的 characters 项：name/type + 有图时的 avatar） */
export function getBackendStoryboardCharacters(
  storyboardId: number,
): { name: string; type: string; avatar?: string }[] {
  const found = storyboards.find((s) => s.id === storyboardId);
  if (!found) return [];
  return found.associateAssetsIds.flatMap((assetId) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return [];
    const avatar = imageSrc(asset);
    return [{ name: asset.name, type: asset.type, ...(avatar ? { avatar } : {}) }];
  });
}

// ===== 分镜图片 / 工作台轨道 / 视频（复刻后端 storyboard + workbench 契约）=====

/** mock 用固定延迟代替真实推理（真实后端单张 4-45s，测试里不能真等） */
const MOCK_GENERATE_MS = 200;

/** 未配 key 时的失败原因：图像侧沿用资产生图的文案，视频侧沿用真实后端「缺少API Key」 */
const DEFAULT_IMAGE_FAIL_REASON = '图像供应商未配置 key';
const DEFAULT_VIDEO_FAIL_REASON = '缺少API Key';

/** 按 id 取分镜（pollingImage / previewImage / downPreviewImage 用） */
export function findBackendStoryboards(ids: number[]): BackendStoryboardRow[] {
  return storyboards.filter((s) => ids.includes(s.id));
}

/** 视频供应商 key 开关：镜像真实后端「未配置时视频生成必失败」的默认态 */
export function setBackendVideoVendorEnabled(enabled: boolean): void {
  videoVendorEnabled = enabled;
}

export function setBackendVideoPromptFailReason(reason: string | null): void {
  videoPromptFailReason = reason;
}

/**
 * 镜像后端 batchGenerateImage：先按 compulsory 决定每个分镜的 state，再在后台生成。
 * - compulsory=true：全部置「生成中」并全部生成（**前端恒发 true**，见 api.ts 的说明）
 * - compulsory=false：shouldGenerateImage=0 的置「未生成」且**跳过生成**，其余置「生成中」
 * 返回受理时的行（后端就是先 res.send 再跑生成循环）。
 */
export function runStoryboardImageStateMachine(
  projectId: number,
  scriptId: number,
  storyboardIds: number[],
  options: { compulsory?: boolean; failReason?: string } = {},
): BackendStoryboardRow[] {
  const matched = storyboards.filter(
    (s) => s.projectId === projectId && s.scriptId === scriptId && storyboardIds.includes(s.id),
  );
  for (const storyboard of matched) {
    if (options.compulsory) {
      storyboard.state = STORYBOARD_IMAGE_STATE.RUNNING;
      storyboard.shouldGenerateImage = 1;
    } else if (storyboard.shouldGenerateImage === 0) {
      storyboard.state = STORYBOARD_IMAGE_STATE.NONE;
    } else {
      storyboard.state = STORYBOARD_IMAGE_STATE.RUNNING;
    }
  }
  const generateList = options.compulsory
    ? matched
    : matched.filter((s) => s.shouldGenerateImage !== 0);
  // 与资产生图共用同一个图像供应商开关：没配 key 时镜像真实后端的失败态
  const failReason =
    options.failReason ?? (imageVendorEnabled ? undefined : DEFAULT_IMAGE_FAIL_REASON);

  schedule(MOCK_GENERATE_MS, () => {
    for (const storyboard of generateList) {
      if (failReason) {
        storyboard.filePath = '';
        storyboard.reason = failReason;
        storyboard.state = STORYBOARD_IMAGE_STATE.FAILED;
        continue;
      }
      storyboard.filePath = `/${projectId}/assets/${scriptId}/mock-${storyboard.id}.png`;
      storyboard.reason = null;
      storyboard.state = STORYBOARD_IMAGE_STATE.DONE;
    }
  });
  return matched;
}

/** 镜像后端 getGenerateData 的 storyboardList：filePath 换成小图 URL 并同时给 src */
export function getBackendStoryboardGenerateRows(
  projectId: number,
  scriptId: number,
): (BackendStoryboardRow & { src: string })[] {
  return getBackendStoryboards(projectId, scriptId).map((s) => ({
    ...s,
    src: s.filePath ? `http://localhost:10588/oss${s.filePath}?size=20` : '',
  }));
}

/** 镜像后端 getGenerateData 的 trackList（o_videoTrack where projectId + scriptId） */
export function getBackendTracks(projectId: number, scriptId: number): BackendTrackRow[] {
  return tracks.filter((t) => t.projectId === projectId && t.scriptId === scriptId).map((t) => ({ ...t }));
}

/** 镜像后端 addTrack：建一条空轨道并返回 id */
export function addBackendTrack(projectId: number, scriptId: number, duration?: number): number {
  return createTrack(projectId, scriptId, duration ?? null).id;
}

/** 镜像后端 deleteTrack：删轨道并把该轨上的分镜 trackId 置空 */
export function deleteBackendTrack(id: number): void {
  tracks = tracks.filter((t) => t.id !== id);
  for (const storyboard of storyboards) {
    if (storyboard.trackId === id) storyboard.trackId = null;
  }
}

/** 镜像后端 updateVideoPrompt：整列覆盖 */
export function setBackendTrackPrompt(id: number, prompt: string): void {
  const found = tracks.find((t) => t.id === id);
  if (found) found.prompt = prompt;
}

/** 镜像后端 updateVideoDuration */
export function setBackendTrackDuration(id: number, duration: number): void {
  const found = tracks.find((t) => t.id === id);
  if (found) found.duration = duration;
}

/** 提示词生成的假产出（镜像后端文本模型写回 o_videoTrack.prompt） */
function fakeVideoPrompt(trackId: number): string {
  return `镜头 ${trackId}：电影感中景，缓慢推进，清冷月光在木质长廊投下阴影，冷蓝色调，浅景深，氛围压抑克制。`;
}

/** 单个轨道的视频提示词生成（镜像后端 generateVideoPrompt 的同步路径） */
export function runSingleVideoPrompt(
  id: number,
  options: { failReason?: string } = {},
): { ok: true; prompt: string } | { ok: false; reason: string } {
  const track = tracks.find((t) => t.id === id);
  if (!track) return { ok: false, reason: '未找到该轨道' };
  const failReason = options.failReason ?? videoPromptFailReason ?? undefined;
  if (failReason) {
    track.state = VIDEO_PROMPT_STATE.FAILED;
    track.reason = failReason;
    return { ok: false, reason: failReason };
  }
  track.prompt = fakeVideoPrompt(track.id);
  track.state = VIDEO_PROMPT_STATE.DONE;
  track.reason = null;
  return { ok: true, prompt: track.prompt };
}

/** 镜像后端 batchGeneratePrompt：受理时置「生成中」并立即返回，后台并发生成 */
export function runBatchVideoPromptStateMachine(
  trackIds: number[],
  options: { failReason?: string } = {},
): void {
  for (const track of tracks) {
    if (trackIds.includes(track.id)) track.state = VIDEO_PROMPT_STATE.RUNNING;
  }
  schedule(MOCK_GENERATE_MS, () => {
    for (const id of trackIds) {
      const track = tracks.find((t) => t.id === id);
      if (!track) continue;
      if (options.failReason) {
        track.state = VIDEO_PROMPT_STATE.FAILED;
        track.reason = options.failReason;
        continue;
      }
      track.prompt = fakeVideoPrompt(track.id);
      track.state = VIDEO_PROMPT_STATE.DONE;
      track.reason = null;
    }
  });
}

/** 镜像后端 checkVideoPrompt：只回终态（已完成 / 生成失败）的轨道 */
export function getBackendTrackPromptStates(
  trackIds: number[],
): { id: number; state: string; reason: string | null; prompt: string | null }[] {
  return tracks
    .filter(
      (t) =>
        trackIds.includes(t.id) &&
        (t.state === VIDEO_PROMPT_STATE.DONE || t.state === VIDEO_PROMPT_STATE.FAILED),
    )
    .map((t) => ({ id: t.id, state: t.state as string, reason: t.reason, prompt: t.prompt }));
}

/**
 * 镜像后端 getVideoList：按**分镜的 trackId** 反查 o_video，回**原始** state。
 *
 * 注意这里是从分镜出发、不是从 o_videoTrack 表出发：后端写的是
 * `whereIn("videoTrackId", storyboardList.map(s => s.trackId))`。
 * 差别在孤立轨道上——分镜被删后轨道还在，但它的视频**不会**出现在这个接口里。
 */
export function getBackendVideos(
  projectId: number,
  scriptId: number,
): (BackendVideoRow & { src: string })[] {
  const trackIds = getBackendStoryboards(projectId, scriptId)
    .map((s) => s.trackId)
    .filter((id): id is number => id != null);
  return videos
    .filter((v) => trackIds.includes(v.videoTrackId))
    .map((v) => ({ ...v, src: `http://localhost:10588/oss${v.filePath}?size=20` }));
}

/** 镜像后端 generateVideo：受理即插一条「生成中」的 o_video，返回其 id */
export function addBackendVideo(projectId: number, scriptId: number, trackId: number): number {
  const id = videoIdSeq++;
  videos.push({
    id,
    projectId,
    scriptId,
    videoTrackId: trackId,
    filePath: `/${projectId}/video/mock-${id}.mp4`,
    state: VIDEO_STATE.RUNNING,
    errorReason: null,
    time: Date.now(),
  });
  return id;
}

/** 镜像后端 checkVideoStateList：只回终态（生成成功 / 生成失败）的视频 */
export function getBackendVideoStates(videoIds: number[]): (BackendVideoRow & { src: string })[] {
  return videos
    .filter(
      (v) =>
        videoIds.includes(v.id) && (v.state === VIDEO_STATE.DONE || v.state === VIDEO_STATE.FAILED),
    )
    .map((v) => ({ ...v, src: `http://localhost:10588/oss${v.filePath}?size=20` }));
}

/** 镜像后端 selectVideo：写 o_videoTrack.videoId */
export function selectBackendTrackVideo(trackId: number, videoId: number): void {
  const found = tracks.find((t) => t.id === trackId);
  if (found) found.videoId = videoId;
}

/** 镜像后端 delVideo：删视频并把选中它的轨道 videoId 置空 */
export function deleteBackendVideo(id: number): void {
  videos = videos.filter((v) => v.id !== id);
  for (const track of tracks) {
    if (track.videoId === id) track.videoId = null;
  }
}

/**
 * 镜像后端视频生成的异步收尾：到点把「生成中」写成成功/失败。
 * 没配视频 key（默认）时一律失败，与真实后端一致；
 * 测试里 `setBackendVideoVendorEnabled(true)` 模拟「key 到位」。
 */
export function runVideoStateMachine(videoIds: number[], options: { failReason?: string } = {}): void {
  const failReason =
    options.failReason ?? (videoVendorEnabled ? undefined : DEFAULT_VIDEO_FAIL_REASON);
  schedule(MOCK_GENERATE_MS, () => {
    for (const id of videoIds) {
      const video = videos.find((v) => v.id === id);
      if (!video) continue;
      if (failReason) {
        video.state = VIDEO_STATE.FAILED;
        video.errorReason = failReason;
        continue;
      }
      video.state = VIDEO_STATE.DONE;
      video.errorReason = null;
    }
  });
}
