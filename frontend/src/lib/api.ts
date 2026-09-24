import { apiFetch, apiFetchBlob, HttpError } from './http';
import { extractStatusFromState, isExtractionActive } from './extractState';
import {
  imageStateFromStatus,
  imageStatusFromState,
  isPromptActive,
  promptStatusFromState,
} from './assetGenState';
import {
  storyboardImageStateFromStatus,
  storyboardImageStatusFromState,
  videoPromptStatusFromState,
  videoStatusFromState,
} from './videoGenState';
import type {
  AddScriptBody,
  Asset,
  AssetListResponse,
  AssetType,
  CreateAssetBody,
  CreateProjectBody,
  CreateStoryboardBody,
  CreditsResponse,
  Episode,
  EpisodeListResponse,
  FlowDataAsset,
  FlowDataDeriveAsset,
  FlowDataStoryboard,
  FlowDataWorkbench,
  NotificationListResponse,
  NovelTaskBody,
  Outline,
  OutlineTaskBody,
  Project,
  ProjectListResponse,
  ProjectStatistics,
  Script,
  ScriptExtractState,
  ScriptListResponse,
  Storyboard,
  StoryboardImageState,
  StudioFlowData,
  SubmitTaskResponse,
  TaskListParams,
  TaskListResponse,
  TaskOption,
  TaskRecord,
  TaskStateName,
  TaskStatus,
  TemplateListResponse,
  TrackVideo,
  UpdateAssetBody,
  UpdateScriptBody,
  UpdateStoryboardBody,
  VideoPromptState,
  VideoState,
  Workbench,
  WorkbenchTrack,
  WorkflowState,
} from '../types/api';

/**
 * 后端全部接口为 POST + JSON body + `{code, data, message}` 信封，
 * REST 动词 / 路径参数 / 字段映射 / id 数字↔字符串 的翻译全部收敛在本模块内。
 */
async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...init });
}

// ===== 项目（后端 o_project）=====

/** 后端 `o_project` 表一行（select * 的形状），id 为 number（Date.now()） */
type ProjectRow = {
  id: number;
  name: string | null;
  intro: string | null;
  projectType: string | null;
  type: string | null;
  artStyle: string | null;
  directorManual: string | null;
  mode: string | null;
  videoRatio: string | null;
  imageModel: string | null;
  videoModel: string | null;
  imageQuality: string | null;
  createTime: number | null;
};

function toProject(row: ProjectRow): Project {
  return {
    id: String(row.id),
    name: row.name ?? '',
    intro: row.intro ?? '',
    projectType: row.projectType ?? DEFAULT_PROJECT_TYPE,
    type: row.type ?? '',
    artStyle: row.artStyle ?? '',
    directorManual: row.directorManual ?? DEFAULT_DIRECTOR_MANUAL,
    mode: row.mode ?? DEFAULT_MODE,
    videoRatio: row.videoRatio ?? '',
    imageModel: row.imageModel ?? '',
    videoModel: row.videoModel ?? '',
    imageQuality: row.imageQuality ?? '',
    createTime: typeof row.createTime === 'number' ? new Date(row.createTime).toISOString() : '',
  };
}

/**
 * 项目写入字段（addProject / editProject 共用的同一份 12 字段载荷）。
 * projectType/directorManual/mode 由前端固定，其余来自表单或已有项目。
 */
function projectWriteBody(v: {
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
}): Record<string, unknown> {
  return {
    projectType: v.projectType,
    name: v.name,
    intro: v.intro,
    type: v.type,
    artStyle: v.artStyle,
    directorManual: v.directorManual,
    videoRatio: v.videoRatio,
    imageModel: v.imageModel,
    videoModel: v.videoModel,
    imageQuality: v.imageQuality,
    mode: v.mode,
  };
}

// 表单不暴露、由前端固定的后端必填字段
const DEFAULT_PROJECT_TYPE = 'script';
const DEFAULT_DIRECTOR_MANUAL = '';
const DEFAULT_MODE = 'text';

export async function listProjects(): Promise<ProjectListResponse> {
  const rows = await postJson<ProjectRow[]>('/api/project/getProject', {});
  return { projects: (rows ?? []).map(toProject) };
}

export async function createProject(body: CreateProjectBody): Promise<Project> {
  await postJson(
    '/api/project/addProject',
    projectWriteBody({
      projectType: DEFAULT_PROJECT_TYPE,
      name: body.name,
      intro: body.intro ?? '',
      type: body.type,
      artStyle: body.artStyle,
      directorManual: DEFAULT_DIRECTOR_MANUAL,
      videoRatio: body.videoRatio,
      imageModel: body.imageModel,
      videoModel: body.videoModel,
      imageQuality: body.imageQuality,
      mode: DEFAULT_MODE,
    }),
  );
  // 后端 addProject 只返回 message；项目 id 是 Date.now() 时间戳，重新拉列表、取最大 id 即为本次新建。
  // 局限：两个新建请求并发返回时可能取到对方的项目，当前界面一次只创建一个，可接受。
  const { projects } = await listProjects();
  const newest = projects.reduce<Project | null>(
    (acc, p) => (acc == null || Number(p.id) > Number(acc.id) ? p : acc),
    null,
  );
  if (!newest) throw new Error('新建项目后未能在列表中找到它');
  return newest;
}

export async function patchProject(id: string, body: { name: string }): Promise<Project> {
  // 后端 editProject 要求全量字段，先取当前项目再合并改名
  const current = await fetchProject(id);
  const merged = { ...current, name: body.name };
  await postJson('/api/project/editProject', {
    id: Number(id),
    ...projectWriteBody(merged),
  });
  return merged;
}

/** 单项目（getSingleProject 翻译），用于打开已有项目时还原配置 */
export async function fetchProject(id: string, signal?: AbortSignal): Promise<Project> {
  const rows = await postJson<ProjectRow[]>(
    '/api/general/getSingleProject',
    { id: Number(id) },
    { signal },
  );
  const current = rows?.[0];
  if (!current) throw new Error('项目不存在');
  return toProject(current);
}

/** 删除项目（后端级联删除剧本/资产/分镜/轨道/任务） */
export async function deleteProject(id: string): Promise<void> {
  await postJson('/api/project/delProject', { id: Number(id) });
}

/** 项目卡计数：角色数 / 剧本数 / 视频数 / 分镜数 */
export async function getProjectStatistics(projectId: string): Promise<ProjectStatistics> {
  const data = await postJson<ProjectStatistics | null>('/api/general/generalStatistics', {
    projectId: Number(projectId),
  });
  return {
    roleCount: data?.roleCount ?? 0,
    scriptCount: data?.scriptCount ?? 0,
    videoCount: data?.videoCount ?? 0,
    storyboardCount: data?.storyboardCount ?? 0,
  };
}

// ===== 任务中心（后端 o_tasks）=====

/** 后端 `o_tasks` 表一行 */
type TaskRow = {
  id: number;
  projectId: number | null;
  taskClass: string | null;
  relatedObjects: string | null;
  model: string | null;
  describe: string | null;
  state: string | null;
  startTime: number | null;
  reason: string | null;
};

/**
 * 任务状态的唯一描述表：前端枚举 ↔ 后端中文文案 ↔ 展示文案。
 * 页面据此生成筛选项；Tag 颜色等纯 UI 信息留在页面。
 */
export const TASK_STATES = {
  running: { backend: '进行中', label: '进行中' },
  succeeded: { backend: '已完成', label: '已完成' },
  failed: { backend: '生成失败', label: '失败' },
} as const satisfies Record<TaskStateName, { backend: string; label: string }>;

function toTaskStateName(state: string): TaskStateName {
  const entry = (Object.keys(TASK_STATES) as TaskStateName[]).find(
    (name) => TASK_STATES[name].backend === state,
  );
  // 后端 state 是闭集（utils/taskRecord.ts 只会写三种），查不到按进行中展示
  return entry ?? 'running';
}

/**
 * getTaskApi 的行是 o_tasks leftJoin o_project（`select("o_tasks.*", "o_project.*")`），
 * 重名列 `id` 会被项目 id 覆盖、join 不上时为 null —— 列表行的 id 不可当作任务 id，故不对外暴露。
 */
function toTaskRecord(row: TaskRow & { name?: string | null }): TaskRecord {
  return {
    projectId: row.projectId != null ? String(row.projectId) : null,
    projectName: row.name ?? null,
    taskClass: row.taskClass ?? '',
    relatedObjects: row.relatedObjects ?? null,
    model: row.model ?? null,
    describe: row.describe ?? '',
    state: toTaskStateName(row.state ?? ''),
    stateText: row.state ?? '',
    startTime: typeof row.startTime === 'number' ? new Date(row.startTime).toISOString() : null,
    reason: row.reason ?? null,
  };
}

export async function listTasks(params: TaskListParams): Promise<TaskListResponse> {
  const body: Record<string, unknown> = { page: params.page, limit: params.limit };
  if (params.state) body.state = TASK_STATES[params.state].backend;
  if (params.taskClass) body.taskClass = params.taskClass;
  if (params.projectId) body.projectId = Number(params.projectId);
  const data = await postJson<{ data: (TaskRow & { name?: string | null })[]; total: number } | null>(
    '/api/task/getTaskApi',
    body,
  );
  return { tasks: (data?.data ?? []).map(toTaskRecord), total: data?.total ?? 0 };
}

/** 任务分类下拉（后端 distinct taskClass） */
export async function listTaskCategories(): Promise<string[]> {
  const rows = await postJson<{ taskClass: string | null }[] | null>('/api/task/getTaskCategories', {});
  return (rows ?? [])
    .map((r) => r.taskClass)
    .filter((c): c is string => Boolean(c));
}

/** 任务中心的项目下拉（后端 id/name 列表） */
export async function listTaskProjects(): Promise<TaskOption[]> {
  const rows = await postJson<{ id: number; name: string | null }[] | null>('/api/task/getProject', {});
  return (rows ?? []).map((r) => ({ id: String(r.id), name: r.name ?? '' }));
}

export async function getTask(taskId: string): Promise<TaskStatus> {
  const row = await postJson<TaskRow | null>('/api/task/taskDetails', { taskId: Number(taskId) });
  if (!row) throw new Error('任务不存在');
  const status = toTaskStateName(row.state ?? '');
  return {
    taskId: String(row.id),
    status,
    // 后端不提供进度数值：已完成=100，其余为 0（实际进度轮询走各业务自带轮询接口）
    progress: status === 'succeeded' ? 100 : 0,
    error: status === 'failed' ? row.reason ?? undefined : undefined,
  };
}

export function getCredits(): Promise<CreditsResponse> {
  return apiFetch('/api/credits');
}

export function submitOutlineTask(projectId: string, body: OutlineTaskBody): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/projects/${projectId}/outline-tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitNovelTask(projectId: string, body: NovelTaskBody): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/projects/${projectId}/novel-tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function finalizeOutline(projectId: string): Promise<WorkflowState> {
  return apiFetch(`/api/projects/${projectId}/outline/finalize`, { method: 'POST' });
}

export function updateScreenplay(projectId: string, screenplay: string): Promise<Outline> {
  return apiFetch(`/api/projects/${projectId}/outline/screenplay`, {
    method: 'PATCH',
    body: JSON.stringify({ screenplay }),
  });
}

// ===== 资产（后端 o_assets / o_image）=====

/**
 * 类型枚举唯一翻译表：前端资产类型 ↔ 后端 type。
 * 后端只有 role/scene/tool；素材（material）无后端对应（getAssetsApi 按 type 过滤查不到）。
 */
export const BACKEND_ASSET_TYPES = {
  character: 'role',
  scene: 'scene',
  prop: 'tool',
} as const satisfies Record<Exclude<AssetType, 'material'>, string>;

const FRONTEND_ASSET_TYPES: Record<string, AssetType> = {
  role: 'character',
  scene: 'scene',
  tool: 'prop',
};

/** getAssetsApi 返回的 o_assets join o_image 行（select o_assets.* + filePath/state，另拼 src/sonAssets） */
export type AssetRow = {
  id: number;
  projectId: number | null;
  name: string | null;
  type: string | null;
  describe: string | null;
  prompt: string | null;
  remark: string | null;
  imageId: number | null;
  /** o_assets.promptState（润色状态中文文案） */
  promptState?: string | null;
  /** o_assets.promptErrorReason（润色失败原因） */
  promptErrorReason?: string | null;
  /** o_image.state（生图状态中文文案，join 不上时后端不输出该键） */
  state?: string | null;
  /** o_image 静态托管 URL（后端拼好） */
  src?: string | null;
  /** 子资产（多形象），本页暂不消费 */
  sonAssets?: unknown[];
};

function toAsset(row: AssetRow): Asset {
  return {
    id: String(row.id),
    projectId: row.projectId != null ? String(row.projectId) : '',
    // 类型过滤查询只会命中 role/scene/tool，兜底 material 仅防御不可达分支
    type: FRONTEND_ASSET_TYPES[row.type ?? ''] ?? 'material',
    name: row.name ?? '',
    description: row.describe ?? '',
    imageUrl: row.src ?? null,
    prompt: row.prompt ?? null,
    remark: row.remark ?? null,
    promptState: promptStatusFromState(row.promptState ?? null),
    promptErrorReason: row.promptErrorReason ?? null,
    imageId: row.imageId != null ? String(row.imageId) : null,
    imageState: imageStatusFromState(row.state ?? null),
  };
}

export type AssetListParams = {
  /** 省略时按后端三类枚举并行取回合并（后端接口必须按单一 type 查询） */
  type?: AssetType;
  page?: number;
  limit?: number;
  /** 按名称模糊搜索（后端 like） */
  name?: string;
};

async function fetchAssetsPage(
  projectId: string,
  type: Exclude<AssetType, 'material'>,
  params: AssetListParams,
): Promise<{ data: AssetRow[]; total: number }> {
  const body: Record<string, unknown> = {
    projectId: Number(projectId),
    type: BACKEND_ASSET_TYPES[type],
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.name) body.name = params.name;
  const data = await postJson<{ data: AssetRow[]; total: number } | null>(
    '/api/assets/getAssetsApi',
    body,
  );
  return { data: data?.data ?? [], total: data?.total ?? 0 };
}

export async function listAssets(
  projectId: string,
  params: AssetListParams = {},
): Promise<AssetListResponse> {
  if (params.type && params.type !== 'material') {
    const { data, total } = await fetchAssetsPage(projectId, params.type, params);
    return { assets: data.map(toAsset), total };
  }
  // 未指定类型：三类并行取回合并（material 无后端对应，恒为空）。
  // 合并结果不分页，每类取前 100 条 —— 供资产库 @ 引用等全量场景使用。
  const types: (Exclude<AssetType, 'material'>)[] = ['character', 'scene', 'prop'];
  const pages = await Promise.all(
    types.map((type) => fetchAssetsPage(projectId, type, { ...params, page: 1, limit: 100 })),
  );
  const assets = pages.flatMap((p) => p.data.map(toAsset));
  return { assets, total: pages.reduce((acc, p) => acc + p.total, 0) };
}

/** 单类型资产总数（类型卡片计数用，limit 1 只取 total） */
export async function countAssets(
  projectId: string,
  type: Exclude<AssetType, 'material'>,
): Promise<number> {
  const { total } = await fetchAssetsPage(projectId, type, { page: 1, limit: 1 });
  return total;
}

/** 手工新增资产（名称/描述/类型），后端只回 message，调用方自行重查列表 */
export async function createAsset(body: CreateAssetBody): Promise<void> {
  const payload: Record<string, unknown> = {
    name: body.name,
    describe: body.description,
    type: BACKEND_ASSET_TYPES[body.type],
    projectId: Number(body.projectId),
  };
  if (body.prompt != null) payload.prompt = body.prompt;
  await postJson('/api/assets/addAssets', payload);
}

/** 编辑资产（名称/描述/提示词/备注）；prompt/remark 原样回传，避免后端全量 update 清空 */
export async function updateAsset(body: UpdateAssetBody): Promise<void> {
  await postJson('/api/assets/updateAssets', {
    id: Number(body.id),
    name: body.name,
    describe: body.description,
    remark: body.remark ?? null,
    prompt: body.prompt ?? null,
  });
}

/** 删除资产（后端级联清理 o_image 与子资产） */
export async function deleteAsset(id: string): Promise<void> {
  await postJson('/api/assets/delAssets', { id: Number(id) });
}

/**
 * 上传资产图片：base64（data URL 或裸 base64）保存到后端静态托管，
 * 成功后资产卡即可展示。type 必须是后端三类之一；prompt 原样回传避免被清空。
 */
export async function uploadAssetImage(body: {
  assetId: string;
  projectId: string;
  type: Exclude<AssetType, 'material'>;
  base64: string;
  prompt?: string | null;
}): Promise<void> {
  await postJson('/api/assets/saveAssets', {
    id: Number(body.assetId),
    projectId: Number(body.projectId),
    base64: body.base64,
    type: BACKEND_ASSET_TYPES[body.type],
    prompt: body.prompt ?? '',
  });
}

// ===== 分集（剧本即分集：后端 o_script + 其分镜聚合）=====

function toEpisode(script: Script, number: number, storyboards: Storyboard[]): Episode {
  return {
    id: script.id,
    projectId: script.projectId,
    number,
    title: script.name,
    storyboardCount: storyboards.length,
    durationSec: storyboards.reduce((sum, s) => sum + (s.durationSec ?? 0), 0),
    coverUrl: storyboards.find((s) => s.imageUrl)?.imageUrl ?? null,
  };
}

/**
 * 分集列表：后端没有"集"这个实体，一个剧本就是一集。
 * 逐剧本取分镜（getStoryboardData 只认 scriptId）聚合出分镜数、总时长与封面。
 */
export async function listEpisodes(
  projectId: string,
  signal?: AbortSignal,
): Promise<EpisodeListResponse> {
  const { scripts } = await listScripts(projectId, signal);
  const ordered = [...scripts].sort((a, b) => Number(a.id) - Number(b.id));
  const storyboardsPerScript = await Promise.all(
    ordered.map((script) => listStoryboards(projectId, script.id, signal)),
  );
  return {
    episodes: ordered.map((script, i) => toEpisode(script, i + 1, storyboardsPerScript[i] ?? [])),
  };
}

// ===== 分镜（后端 o_storyboard）=====

/** getStoryboardData 返回的一行；后端会整键省掉无值的 duration/filePath/index */
export type StoryboardRow = {
  id: string | number;
  scriptId?: number;
  prompt?: string;
  duration?: number;
  /** 后端静态托管的小图 URL；无图时该键不存在 */
  filePath?: string;
  /** 关联资产（type 为后端 role/scene/tool） */
  characters?: { name?: string; type?: string; avatar?: string }[];
  /** 分镜排序位（仅 AI 分镜 Agent 与 FlowData 写；本页暂不消费） */
  index?: number | null;
};

function toStoryboard(row: StoryboardRow): Storyboard {
  return {
    id: String(row.id),
    scriptId: row.scriptId != null ? String(row.scriptId) : '',
    prompt: row.prompt ?? '',
    durationSec: typeof row.duration === 'number' ? row.duration : null,
    imageUrl: row.filePath ? row.filePath : null,
    characters: (row.characters ?? []).map((c) => ({
      name: c.name ?? '',
      type: FRONTEND_ASSET_TYPES[c.type ?? ''] ?? 'material',
      avatarUrl: c.avatar ?? null,
    })),
  };
}

/** 分镜列表（进入工作室页即加载当前剧本的真实分镜） */
export async function listStoryboards(
  projectId: string,
  scriptId: string,
  signal?: AbortSignal,
): Promise<Storyboard[]> {
  const rows = await postJson<StoryboardRow[] | null>(
    '/api/production/getStoryboardData',
    { scriptId: Number(scriptId), projectId: Number(projectId) },
    { signal },
  );
  return (rows ?? []).map(toStoryboard);
}

/**
 * 新增分镜：后端同事务建一条 o_videoTrack（09 的视频轨道以它为单位），返回新分镜 id。
 * state/shouldGenerateImage 按后端「未生成 + 无图」的约定给值。
 *
 * 描述同时写入 prompt 与 videoDesc 两列：后端没有「景别/运镜」列，两者由页面拼进描述文本；
 * 而 09 的 AI 生成视频提示词以 videoDesc 为核心输入，只写 prompt 会让它读不到。
 */
export async function createStoryboard(body: CreateStoryboardBody): Promise<string> {
  const data = await postJson<{ id: number }>('/api/production/storyboard/addStoryboard', {
    prompt: body.prompt,
    duration: body.durationSec,
    state: '未生成',
    videoDesc: body.prompt,
    shouldGenerateImage: 0,
    src: null,
    scriptId: Number(body.scriptId),
    projectId: Number(body.projectId),
  });
  return String(data.id);
}

/** 编辑分镜描述（后端 editStoryboardInfo 整行覆盖 prompt + videoDesc，故两者同值回传） */
export async function updateStoryboard(body: UpdateStoryboardBody): Promise<void> {
  await postJson('/api/production/storyboard/editStoryboardInfo', {
    id: Number(body.id),
    prompt: body.prompt,
    videoDesc: body.prompt,
  });
}

/** 删除单个分镜（后端 removeFrame：连带清掉该分镜独占的视频轨道） */
export async function deleteStoryboard(id: string): Promise<void> {
  await postJson('/api/production/storyboard/removeFrame', { id: Number(id) });
}

/** 批量删除分镜（后端 batchDelete 按 projectId 过滤；ids 为空会被后端拒绝） */
export async function deleteStoryboards(projectId: string, ids: string[]): Promise<void> {
  await postJson('/api/production/storyboard/batchDelete', {
    ids: ids.map(Number),
    projectId: Number(projectId),
  });
}

export function listTemplates(): Promise<TemplateListResponse> {
  return apiFetch('/api/templates');
}

export function listNotifications(): Promise<NotificationListResponse> {
  return apiFetch('/api/notifications');
}

export type CreativeTaskBody = {
  kind: 'image' | 'video';
  prompt: string;
};

export function submitCreativeTask(body: CreativeTaskBody): Promise<SubmitTaskResponse> {
  return apiFetch('/api/creative-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ===== 资产 AI：润色与生图（后端 assetsGenerate）=====

/** 资产 AI 请求（润色 / 生图）共用的资产载荷（name/description 为触发时的快照） */
export type AssetAiItem = {
  assetId: string;
  type: Exclude<AssetType, 'material'>;
  name: string;
  description: string;
};

/** 单个资产提示词 AI 润色（同步接口：等文本模型返回，新提示词已持久化到 o_assets.prompt） */
export async function polishAssetPrompt(
  body: AssetAiItem & { projectId: string },
): Promise<string> {
  const data = await postJson<{ prompt: string | null; assetsId: number }>(
    '/api/assetsGenerate/polishAssetsPrompt',
    {
      assetsId: Number(body.assetId),
      projectId: Number(body.projectId),
      type: BACKEND_ASSET_TYPES[body.type],
      name: body.name,
      describe: body.description,
    },
  );
  if (data?.prompt == null) throw new Error('润色结果为空');
  return data.prompt;
}

/**
 * 批量提示词 AI 润色（异步接口：后端受理后立即返回，后台并发生成，
 * 结果持久化到各资产行）。完成进度由 pollAssetPromptsUntilSettled 轮询。
 */
export async function batchPolishAssetPrompts(
  projectId: string,
  items: AssetAiItem[],
  options: { concurrentCount?: number; otherTextPrompt?: string } = {},
): Promise<number> {
  const data = await postJson<{ total: number | null } | null>(
    '/api/assetsGenerate/batchPolishAssetsPrompt',
    {
      projectId: Number(projectId),
      items: items.map((item) => ({
        assetsId: Number(item.assetId),
        type: BACKEND_ASSET_TYPES[item.type],
        name: item.name,
        describe: item.description,
      })),
      concurrentCount: options.concurrentCount ?? 1,
      // 后端 zod 必填；无额外要求时发空串
      otherTextPrompt: options.otherTextPrompt ?? '',
    },
  );
  return data?.total ?? items.length;
}

/** 批量润色轮询的一拍：提交的资产id → 润色状态 */
export type AssetPromptState = {
  id: string;
  promptState: Asset['promptState'];
  promptErrorReason: string | null;
};

/** 批量润色轮询超时（后台任务卡死时兜底，避免无限轮询） */
export class PromptPollTimeoutError extends Error {
  constructor(message = '提示词润色超时') {
    super(message);
    this.name = 'PromptPollTimeoutError';
  }
}

/**
 * 批量润色轮询编排：后端无专用轮询接口，读模型就是资产列表
 * （getAssetsApi 行自带 promptState），故每拍全量取回本项目资产、
 * 过滤出提交的 id 回调 onTick，直到全部到达终态（已完成/失败）。
 * 超时抛 PromptPollTimeoutError；取消抛 AbortError。
 */
export async function pollAssetPromptsUntilSettled(
  projectId: string,
  assetIds: string[],
  options: {
    onTick: (states: AssetPromptState[]) => void;
    intervalMs?: number;
    timeoutMs?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const startedAt = Date.now();

  for (;;) {
    const { assets } = await listAssets(projectId);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const states: AssetPromptState[] = assets
      .filter((a) => assetIds.includes(a.id))
      .map((a) => ({ id: a.id, promptState: a.promptState, promptErrorReason: a.promptErrorReason }));
    options.onTick(states);

    // 全部到达终态即结束；某 id 在响应中缺失（资产被删）也不再等
    const pending = states.filter((s) => isPromptActive(s.promptState));
    if (pending.length === 0) return;

    if (Date.now() - startedAt > timeoutMs) {
      throw new PromptPollTimeoutError();
    }
    await waitForTick(intervalMs, signal);
  }
}

/** 资产 AI 生图结果：path 是后端静态托管的小图 URL */
export type GeneratedAssetImage = {
  imageUrl: string;
  assetId: string;
};

/**
 * 资产 AI 生图（同步接口：后端先落 o_image 占位并挂到资产上，再调图像模型，
 * 失败把 o_image 置「生成失败」并返回携带原因的错误）。
 * model/resolution 按后端自身约定取项目配置：o_project.imageModel（期望
 * 「供应商id:模型名」）/ imageQuality；图像 key 未到位时后端报错，原因原样透出。
 */
export async function generateAssetImage(
  body: AssetAiItem & {
    projectId: string;
    /** 图像模型（项目配置 o_project.imageModel） */
    model: string;
    /** 生成尺寸（项目配置 o_project.imageQuality） */
    resolution: string;
    /** 参考图（已上传图片的 base64，可选） */
    base64?: string | null;
    /** 生图提示词；为空时由调用方回退到描述 */
    prompt: string;
  },
): Promise<GeneratedAssetImage> {
  const payload: Record<string, unknown> = {
    projectId: Number(body.projectId),
    model: body.model,
    resolution: body.resolution,
    id: Number(body.assetId),
    type: BACKEND_ASSET_TYPES[body.type],
    name: body.name,
    prompt: body.prompt,
  };
  if (body.base64 != null) payload.base64 = body.base64;
  const data = await postJson<{ path: string | null; assetsId: number } | null>(
    '/api/assetsGenerate/generateAssets',
    payload,
  );
  if (data?.path == null) throw new Error('生成结果为空');
  return { imageUrl: data.path, assetId: String(data.assetsId) };
}

/** 取消生图：把进行中的 o_image 行置「生成失败」（后端不做真正的任务取消） */
export async function cancelAssetImageGeneration(imageId: string): Promise<void> {
  await postJson('/api/assetsGenerate/cancelGenerate', { id: Number(imageId) });
}

// ===== 剧本（后端 o_script）=====

/** 后端 `o_script` 表一行（id 为自增 number） - 仅用于测试导出 */
export type ScriptRow = {
  id: number;
  projectId: number | null;
  name: string | null;
  content: string | null;
  extractState: number | null;
  errorReason: string | null;
  createTime: number | null;
};

/** 后端 extractState 整数 → 前端命名状态（翻译表在 extractState.ts，只此一份） */
function toExtractStatus(state: number | null): Script['extractStatus'] {
  return extractStatusFromState(state);
}

function toScript(row: ScriptRow): Script {
  return {
    id: String(row.id),
    projectId: row.projectId != null ? String(row.projectId) : '',
    name: row.name ?? '',
    content: row.content ?? '',
    extractStatus: toExtractStatus(row.extractState),
    errorReason: row.errorReason ?? null,
    createTime: typeof row.createTime === 'number' ? new Date(row.createTime).toISOString() : '',
  };
}

export async function listScripts(projectId: string, signal?: AbortSignal): Promise<ScriptListResponse> {
  const rows = await postJson<ScriptRow[]>(
    '/api/script/getScrptApi',
    { projectId: Number(projectId) },
    { signal },
  );
  return { scripts: (rows ?? []).map(toScript) };
}

export async function addScript(body: AddScriptBody): Promise<void> {
  // 后端 zod 四字段必填；assets 键必须存在（空数组=不建剧本-资产关联）
  await postJson('/api/script/addScript', {
    projectId: Number(body.projectId),
    name: body.name,
    content: body.content,
    assets: [],
  });
}

export async function updateScript(body: UpdateScriptBody): Promise<void> {
  // 后端 zod 四字段必填；assets 传空数组=不改动剧本-资产关联
  await postJson('/api/script/updateScript', {
    id: Number(body.id),
    name: body.name,
    content: body.content,
    assets: [],
  });
}

export async function deleteScript(id: string): Promise<void> {
  // 后端 delScript 是批量语义（ids 数组）
  await postJson('/api/script/delScript', { ids: [Number(id)] });
}

/**
 * 触发 AI 资产提取：后端收到后把剧本置为等待提取并立即返回，
 * 后台异步调用真实大模型，完成后写入 o_assets、状态转 done/failed。
 */
export async function extractScriptAssets(projectId: string, scriptIds: string[]): Promise<void> {
  await postJson('/api/script/extractAssets', {
    projectId: Number(projectId),
    scriptIds: scriptIds.map(Number),
  });
}

/** 轮询提取状态（后端只认 ids 数字数组，不按项目过滤） */
export async function pollScriptAssets(
  ids: string[],
  signal?: AbortSignal,
): Promise<ScriptExtractState[]> {
  const rows = await postJson<{ id: number; extractState: number | null; errorReason: string | null }[]>(
    '/api/script/pollScriptAssets',
    { ids: ids.map(Number) },
    { signal },
  );
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    extractStatus: toExtractStatus(row.extractState),
    errorReason: row.errorReason ?? null,
  }));
}

/** 提取轮询超时（后端任务丢失/队列卡死时兜底，避免无限轮询） */
export class ExtractionTimeoutError extends Error {
  constructor(message = '资产提取超时') {
    super(message);
    this.name = 'ExtractionTimeoutError';
  }
}

/** 可取消的间隔等待（abort 时抛 AbortError，与 fetch 取消一致） */
function waitForTick(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 提取轮询编排（异步任务的循环/间隔/超时/终态判定收敛在 API client）：
 * 立即查一拍并回调 onTick，之后每 intervalMs 轮询，直到所有剧本到达
 * 终态（done/failed）；超时抛 ExtractionTimeoutError；取消抛 AbortError。
 * 页面只负责把每拍结果映射到 UI。
 */
export async function pollExtractionUntilDone(
  ids: string[],
  options: {
    onTick: (states: ScriptExtractState[]) => void;
    intervalMs?: number;
    timeoutMs?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  const intervalMs = options.intervalMs ?? 2500;
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const startedAt = Date.now();

  for (;;) {
    const states = await pollScriptAssets(ids, signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    options.onTick(states);

    // 全部到达终态（无等待/提取中）即结束；某 id 在响应中缺失（剧本被删）也不再等
    const pending = ids.filter((id) => {
      const state = states.find((s) => s.id === id);
      return state ? isExtractionActive(state.extractStatus) : false;
    });
    if (pending.length === 0) return;

    if (Date.now() - startedAt > timeoutMs) {
      throw new ExtractionTimeoutError();
    }
    await waitForTick(intervalMs, signal);
  }
}

/**
 * 项目下是否有资产（角色/场景/道具）。走 cornerScape/getAllAssets：
 * 返回全部父资产（排除 clip/audio），比 generalStatistics 可靠——
 * 后者按中文 type（"角色"/"分镜"）统计，但代码只写英文 type，计数恒为 0。
 */
export async function projectHasAssets(projectId: string, signal?: AbortSignal): Promise<boolean> {
  const rows = await postJson<unknown[] | null>(
    '/api/cornerScape/getAllAssets',
    { projectId: Number(projectId) },
    { signal },
  );
  return (rows ?? []).length > 0;
}

// ===== 分镜图片（后端 production/storyboard 接口族）=====

/**
 * 图像服务的后端并发数。服务端单卡串行，实测 4 路并发会让单张从 4s 掉到 45s 级，
 * 反而比串行慢一个数量级，故这里显式压到 2（后端默认 5 太激进）。
 */
const IMAGE_CONCURRENT_COUNT = 2;

/**
 * 提交分镜图片批量生成。后端在响应发出前就把 state 置好，随后在后台按并发数生成，
 * 故此处不返回结果，进度由 pollStoryboardImagesUntilSettled 轮询。
 *
 * **`compulsory` 恒为 true**：后端非 compulsory 路径只生成 `shouldGenerateImage !== 0`
 * 的分镜，而 `addStoryboard` 在 `src` 为空时写的是 `shouldGenerateImage = 0`
 * （实测：全新分镜非 compulsory 提交后整批停在「未生成」，一张都不生成）。
 * 界面上的「只生成未出图的」由调用方在 storyboardIds 上过滤，不靠这个开关。
 */
export async function generateStoryboardImages(body: {
  projectId: string;
  scriptId: string;
  storyboardIds: string[];
  concurrentCount?: number;
}): Promise<void> {
  await postJson('/api/production/storyboard/batchGenerateImage', {
    projectId: Number(body.projectId),
    scriptId: Number(body.scriptId),
    storyboardIds: body.storyboardIds.map(Number),
    compulsory: true,
    concurrentCount: body.concurrentCount ?? IMAGE_CONCURRENT_COUNT,
  });
}

/** pollingImage 返回的一行：后端已把 filePath 换成小图 URL */
type StoryboardImageRow = {
  id: string | number;
  state?: string | null;
  reason?: string | null;
  src?: string | null;
};

function toStoryboardImageState(row: StoryboardImageRow): StoryboardImageState {
  return {
    id: String(row.id),
    status: storyboardImageStatusFromState(row.state ?? null),
    errorReason: row.reason ? row.reason : null,
    imageUrl: row.src ? row.src : null,
  };
}

/**
 * 分镜图片轮询一拍。后端 `whereNot("state", "生成中")` ——
 * **正在生成的分镜整个不出现在响应里**，调用方须把「缺失的 id」理解为「仍在生成」。
 */
export async function pollStoryboardImages(
  ids: string[],
  signal?: AbortSignal,
): Promise<StoryboardImageState[]> {
  const rows = await postJson<StoryboardImageRow[] | null>(
    '/api/production/storyboard/pollingImage',
    { ids: ids.map(Number) },
    { signal },
  );
  return (rows ?? []).map(toStoryboardImageState);
}

/** 分镜生图轮询超时（后端任务丢失/模型挂起时兜底，避免无限轮询） */
export class StoryboardImagePollTimeoutError extends Error {
  constructor(message = '分镜图片生成超时') {
    super(message);
    this.name = 'StoryboardImagePollTimeoutError';
  }
}

/** 分镜图片批量生成轮询间隔（真实图像模型单张数十秒） */
const STORYBOARD_IMAGE_POLL_INTERVAL_MS = 2500;

/**
 * 轮询直到每个分镜都从响应里「出现」（= 离开「生成中」到达终态）。
 * 与资产提取轮询相反：那边缺失=已被删、可以直接停；这边缺失=仍在生成、必须继续等。
 */
export async function pollStoryboardImagesUntilSettled(
  ids: string[],
  options: {
    onTick: (states: StoryboardImageState[]) => void;
    intervalMs?: number;
    timeoutMs?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  await pollUntilAllPresent(
    ids,
    (innerSignal) => pollStoryboardImages(ids, innerSignal),
    {
      onTick: options.onTick,
      intervalMs: options.intervalMs ?? STORYBOARD_IMAGE_POLL_INTERVAL_MS,
      timeoutMs: options.timeoutMs ?? 5 * 60_000,
      timeoutError: () => new StoryboardImagePollTimeoutError(),
    },
    signal,
  );
}

/**
 * 分镜图片预览：后端把多张图等比缩放后拼成一张带 S01… 标号的网格图，
 * 以 `data:image/jpeg;base64,…` 返回；一张有效图都没有时回 null。
 */
export async function previewStoryboardImages(storyboardIds: string[]): Promise<string | null> {
  const dataUrl = await postJson<string | null>('/api/production/storyboard/previewImage', {
    storyboardIds: storyboardIds.map(Number),
  });
  return dataUrl ?? null;
}

/**
 * 分镜图片预览下载：后端回 PNG 附件（非信封），一张有效图都没有时回 204 → null。
 * 调用方负责把 Blob 转成浏览器下载。
 */
export async function downloadStoryboardPreview(storyboardIds: string[]): Promise<Blob | null> {
  return apiFetchBlob('/api/production/storyboard/downPreviewImage', {
    method: 'POST',
    body: JSON.stringify({ storyboardIds: storyboardIds.map(Number) }),
  });
}

// ===== 工作台轨道（后端 production/workbench 接口族）=====

/** 后端 `o_videoTrack` 表一行 */
type VideoTrackRow = {
  id: number;
  projectId?: number | null;
  scriptId?: number | null;
  duration?: number | string | null;
  prompt?: string | null;
  state?: string | null;
  reason?: string | null;
  /**
   * 当前选中的视频版本。**响应里的键叫 `selectVideoId`**（后端
   * `selectVideoId: Number(item?.videoId)` —— 表列名 videoId，出参改名了），
   * 未选择时是 0 而不是 null。
   */
  selectVideoId?: number | null;
};

/** 后端 `o_video` 表一行 */
type VideoRow = {
  id: number;
  videoTrackId?: number | null;
  state?: string | null;
  errorReason?: string | null;
  filePath?: string | null;
  /** 后端拼好的静态托管 URL（getVideoList / checkVideoStateList 都会带上） */
  src?: string | null;
};

function toTrackVideo(row: VideoRow): TrackVideo {
  const status = videoStatusFromState(row.state ?? null);
  return {
    id: String(row.id),
    trackId: row.videoTrackId != null ? String(row.videoTrackId) : null,
    status,
    // 后端在受理时就预分配了 filePath，所以失败的行也带 src——那个地址下面没有文件。
    // 只有真正生成成功的版本才对外给 url，免得页面拿它去 <video src> 撞 404。
    url: status === 'done' && row.src ? row.src : null,
    errorReason: row.errorReason ? row.errorReason : null,
  };
}

/**
 * 轨道上的视频版本列表（后端 getVideoList）。后端按分镜的 trackId 反查 o_video，
 * 返回的是**原始 state**（生成中/生成成功/生成失败）——比 getGenerateData 的
 * videoList 可靠（后者用「已完成」判成功，会把「生成成功」的行掉成「未生成」）。
 */
export async function listTrackVideos(
  projectId: string,
  scriptId: string,
  signal?: AbortSignal,
): Promise<TrackVideo[]> {
  const rows = await postJson<VideoRow[] | null>(
    '/api/production/workbench/getVideoList',
    { projectId: Number(projectId), scriptId: Number(scriptId) },
    { signal },
  );
  return (rows ?? []).map(toTrackVideo);
}

/** getGenerateData 返回的分镜行（= o_storyboard 整行，filePath 已被换成小图 URL） */
type GenerateStoryboardRow = {
  id: number;
  prompt?: string | null;
  duration?: number | string | null;
  state?: string | null;
  reason?: string | null;
  trackId?: number | null;
  /** 后端把 filePath 换成小图 URL 后同时回 filePath 与 src；无图为空串 */
  src?: string | null;
};

type GenerateData = {
  storyboardList?: GenerateStoryboardRow[] | null;
  trackList?: VideoTrackRow[] | null;
};

function toSeconds(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 工作台读模型：`getGenerateData`（轨道 + 分镜）+ `getVideoList`（视频版本）合并。
 *
 * 为什么要合并：轨道上的提示词与状态只有 getGenerateData 给，而视频版本的
 * 真实 state 只有 getVideoList 给（见 listTrackVideos 注释）。
 *
 * 轨道时长取「轨道自己的 duration，没有则用分镜的 duration」——addStoryboard
 * 建轨时不传 duration，只靠分镜时长兜底才不会让视频生成拿到 0。
 */
export async function fetchWorkbench(
  projectId: string,
  scriptId: string,
  signal?: AbortSignal,
): Promise<Workbench> {
  const [data, videos] = await Promise.all([
    fetchGenerateData(projectId, scriptId, signal),
    listTrackVideos(projectId, scriptId, signal),
  ]);

  const storyboardRows = data.storyboardList ?? [];
  const storyboards = storyboardRows.map((row) => ({
    id: String(row.id),
    status: storyboardImageStatusFromState(row.state ?? null),
    errorReason: row.reason ? row.reason : null,
    imageUrl: row.src ? row.src : null,
    trackId: row.trackId != null ? String(row.trackId) : null,
  }));
  const storyboardByTrack = new Map<string, { row: GenerateStoryboardRow; number: number }>();
  storyboardRows.forEach((row, i) => {
    if (row.trackId == null) return;
    const key = String(row.trackId);
    if (!storyboardByTrack.has(key)) storyboardByTrack.set(key, { row, number: i + 1 });
  });

  const tracks: WorkbenchTrack[] = (data.trackList ?? []).map((track) => {
    const trackId = String(track.id);
    const matched = storyboardByTrack.get(trackId);
    // 轨道自己的 duration 读到 0 也算「没设」——addStoryboard 建轨时不写 duration，
    // getGenerateData 把 null 折成 0，所以不能只用 ?? 判空，否则视频生成会拿到 0 秒。
    const ownDuration = toSeconds(track.duration);
    // 后端 selectVideoId 是 Number(videoId)：未选择时是 0 或 NaN，都不是合法 id
    const selectedVideoId = Number(track.selectVideoId);
    return {
      id: trackId,
      storyboardId: matched ? String(matched.row.id) : null,
      number: matched ? matched.number : null,
      description: matched?.row.prompt ?? '',
      imageUrl: matched?.row.src ? matched.row.src : null,
      durationSec: ownDuration ? ownDuration : toSeconds(matched?.row.duration),
      videoPrompt: track.prompt ?? '',
      promptStatus: videoPromptStatusFromState(track.state ?? null),
      promptErrorReason: track.reason ? track.reason : null,
      selectedVideoId: Number.isFinite(selectedVideoId) && selectedVideoId > 0 ? String(selectedVideoId) : null,
      videos: videos.filter((video) => video.trackId === trackId),
    };
  });

  return { storyboards, tracks };
}

async function fetchGenerateData(
  projectId: string,
  scriptId: string,
  signal?: AbortSignal,
): Promise<GenerateData> {
  try {
    const data = await postJson<GenerateData | null>(
      '/api/production/workbench/getGenerateData',
      { projectId: Number(projectId), scriptId: Number(scriptId) },
      { signal },
    );
    return data ?? {};
  } catch (err) {
    // 后端在「项目未配置视频模型」时返回 HTTP 400 却套了成功信封
    // （data 是原因文案、message 恒为默认的「成功」），是该接口唯一会出现的
    // 400 +「成功」组合，翻译成可读原因而不是把「成功」当错误弹给用户。
    if (err instanceof HttpError && err.status === 400 && err.message === '成功') {
      throw new Error('项目未配置视频模型，无法加载工作台');
    }
    throw err;
  }
}

/**
 * 新建一条空轨道（后端 addTrack，返回 trackId）。
 * 页面不直接调用：新增分镜时后端 addStoryboard 已在同事务里建轨，
 * 再建会产生没有分镜的孤立轨道（getGenerateData 会把它列出来但 medias 为空）。
 */
export async function createVideoTrack(
  projectId: string,
  scriptId: string,
  durationSec?: number,
): Promise<string> {
  const payload: Record<string, unknown> = {
    projectId: Number(projectId),
    scriptId: Number(scriptId),
  };
  if (durationSec != null) payload.duration = durationSec;
  const trackId = await postJson<number>('/api/production/workbench/addTrack', payload);
  return String(trackId);
}

/** 删除轨道（后端 deleteTrack：连带把该轨上的分镜 trackId 置空） */
export async function deleteVideoTrack(trackId: string): Promise<void> {
  await postJson('/api/production/workbench/deleteTrack', { id: Number(trackId) });
}

/** 选择/切换轨道使用的视频版本（后端 selectVideo，写 o_videoTrack.videoId） */
export async function selectTrackVideo(trackId: string, videoId: string): Promise<void> {
  await postJson('/api/production/workbench/selectVideo', {
    trackId: Number(trackId),
    videoId: Number(videoId),
  });
}

/** 删除一个视频版本（后端 delVideo：连带把选中它的轨道 videoId 置空） */
export async function deleteTrackVideo(videoId: string): Promise<void> {
  await postJson('/api/production/workbench/delVideo', { id: Number(videoId) });
}

/**
 * 视频生成状态轮询一拍。后端 `whereIn("state", ["生成成功","生成失败"])` ——
 * **生成中的视频整个不出现在响应里**，缺失即「仍在生成」。
 */
export async function pollVideoStates(
  params: { projectId: string; scriptId: string; videoIds: string[] },
  signal?: AbortSignal,
): Promise<VideoState[]> {
  const rows = await postJson<VideoRow[] | null>(
    '/api/production/workbench/checkVideoStateList',
    {
      projectId: Number(params.projectId),
      scriptId: Number(params.scriptId),
      videoIds: params.videoIds.map(Number),
    },
    { signal },
  );
  return (rows ?? []).map((row) => {
    const video = toTrackVideo(row);
    return {
      id: video.id,
      status: video.status,
      url: video.url,
      errorReason: video.errorReason,
    };
  });
}

/** 视频生成轮询超时 */
export class VideoPollTimeoutError extends Error {
  constructor(message = '视频生成超时') {
    super(message);
    this.name = 'VideoPollTimeoutError';
  }
}

/** 视频生成轮询间隔（真实视频模型按分钟计） */
const VIDEO_POLL_INTERVAL_MS = 5000;

/** 轮询直到每个视频都离开「生成中」（后端只回终态，缺失即仍在生成） */
export async function pollVideosUntilSettled(
  params: { projectId: string; scriptId: string; videoIds: string[] },
  options: {
    onTick: (states: VideoState[]) => void;
    intervalMs?: number;
    timeoutMs?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  await pollUntilAllPresent(
    params.videoIds,
    (innerSignal) => pollVideoStates(params, innerSignal),
    {
      onTick: options.onTick,
      intervalMs: options.intervalMs ?? VIDEO_POLL_INTERVAL_MS,
      timeoutMs: options.timeoutMs ?? 10 * 60_000,
      timeoutError: () => new VideoPollTimeoutError(),
    },
    signal,
  );
}

// ===== 视频提示词与视频生成（后端 workbench 接口族）=====

/**
 * 提示词/视频生成共用的轨道输入。`sources` 恒为 storyboard：
 * 一镜一轨，参考图就是该分镜自己的画面（分镜还没生图时后端取不到 filePath，
 * 视频模型会以纯文生视频跑）。
 */
export type TrackGenInput = {
  trackId: string;
  storyboardId: string;
};

function toInfoItems(items: TrackGenInput[]): { id: number; sources: string }[] {
  return items.map((item) => ({ id: Number(item.storyboardId), sources: 'storyboard' }));
}

/**
 * 单个轨道的视频提示词 AI 生成（同步接口：等文本模型返回，已写入 o_videoTrack.prompt）。
 * 后端失败时把轨道置「生成失败」并以 HTTP 400 + 错误信封返回原因。
 * model/mode 来自项目配置（o_project.videoModel / mode）——后端用它们挑提示词模板，
 * 模型名本身不影响这条链路（真正的调用固定走 universalAi 文本模型）。
 */
export async function generateTrackVideoPrompt(
  body: TrackGenInput & { projectId: string; model: string; mode: string },
): Promise<string> {
  const text = await postJson<string | null>('/api/production/workbench/generateVideoPrompt', {
    trackId: Number(body.trackId),
    projectId: Number(body.projectId),
    info: toInfoItems([body]),
    model: body.model,
    mode: body.mode,
  });
  if (text == null) throw new Error('提示词生成结果为空');
  return text;
}

/**
 * 批量视频提示词生成（异步接口：后端受理后立即返回，后台按并发数生成，
 * 结果写入各轨道）。进度由 pollVideoPromptsUntilSettled 轮询。
 */
export async function batchGenerateTrackVideoPrompts(body: {
  projectId: string;
  tracks: TrackGenInput[];
  model: string;
  mode: string;
  concurrentCount?: number;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    projectId: Number(body.projectId),
    trackData: body.tracks.map((track) => ({
      trackId: Number(track.trackId),
      info: toInfoItems([track]),
    })),
    model: body.model,
    mode: body.mode,
  };
  if (body.concurrentCount != null) payload.concurrentCount = body.concurrentCount;
  await postJson('/api/production/workbench/batchGeneratePrompt', payload);
}

/** checkVideoPrompt 返回的一行（后端只回「已完成/生成失败」的轨道） */
type VideoPromptRow = {
  id: number;
  state?: string | null;
  reason?: string | null;
  prompt?: string | null;
};

/**
 * 视频提示词轮询一拍。后端 `whereIn("state", ["已完成","生成失败"])` ——
 * 还在生成的轨道不出现在响应里，缺失即「仍在生成」。
 */
export async function pollVideoPrompts(
  params: { projectId: string; scriptId: string; trackIds: string[] },
  signal?: AbortSignal,
): Promise<VideoPromptState[]> {
  const rows = await postJson<VideoPromptRow[] | null>(
    '/api/production/workbench/checkVideoPrompt',
    {
      projectId: Number(params.projectId),
      scriptId: Number(params.scriptId),
      trackIds: params.trackIds.map(Number),
    },
    { signal },
  );
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    status: videoPromptStatusFromState(row.state ?? null),
    prompt: row.prompt ?? '',
    errorReason: row.reason ? row.reason : null,
  }));
}

/** 视频提示词轮询超时 */
export class VideoPromptPollTimeoutError extends Error {
  constructor(message = '视频提示词生成超时') {
    super(message);
    this.name = 'VideoPromptPollTimeoutError';
  }
}

/** 视频提示词轮询间隔（文本模型，一轨约十秒级） */
const VIDEO_PROMPT_POLL_INTERVAL_MS = 3000;

/** 轮询直到每个轨道的提示词都离开「生成中」 */
export async function pollVideoPromptsUntilSettled(
  params: { projectId: string; scriptId: string; trackIds: string[] },
  options: {
    onTick: (states: VideoPromptState[]) => void;
    intervalMs?: number;
    timeoutMs?: number;
  },
  signal?: AbortSignal,
): Promise<void> {
  await pollUntilAllPresent(
    params.trackIds,
    (innerSignal) => pollVideoPrompts(params, innerSignal),
    {
      onTick: options.onTick,
      intervalMs: options.intervalMs ?? VIDEO_PROMPT_POLL_INTERVAL_MS,
      timeoutMs: options.timeoutMs ?? 5 * 60_000,
      timeoutError: () => new VideoPromptPollTimeoutError(),
    },
    signal,
  );
}

/** 编辑并保存视频提示词（后端 updateVideoPrompt，整列覆盖） */
export async function updateTrackVideoPrompt(trackId: string, prompt: string): Promise<void> {
  await postJson('/api/production/workbench/updateVideoPrompt', {
    id: Number(trackId),
    prompt,
  });
}

/** 修改轨道时长（后端 updateVideoDuration，视频生成按它定长） */
export async function updateTrackVideoDuration(trackId: string, durationSec: number): Promise<void> {
  await postJson('/api/production/workbench/updateVideoDuration', {
    id: Number(trackId),
    duration: durationSec,
  });
}

/**
 * 视频生成（异步接口：后端先落一条 o_video「生成中」并立即返回其 id，
 * 生成结果写回该行）。失败态由 pollVideosUntilSettled 轮询出来。
 * model/mode/resolution 来自项目配置；resolution 见 config/project.ts 的说明。
 */
export async function generateTrackVideo(
  body: TrackGenInput & {
    projectId: string;
    scriptId: string;
    prompt: string;
    model: string;
    mode: string;
    resolution: string;
    durationSec: number;
    audio?: boolean;
  },
): Promise<string> {
  const payload: Record<string, unknown> = {
    projectId: Number(body.projectId),
    scriptId: Number(body.scriptId),
    trackId: Number(body.trackId),
    uploadData: toInfoItems([body]),
    prompt: body.prompt,
    model: body.model,
    mode: body.mode,
    resolution: body.resolution,
    duration: body.durationSec,
  };
  if (body.audio != null) payload.audio = body.audio;
  const videoId = await postJson<number>('/api/production/workbench/generateVideo', payload);
  return String(videoId);
}

/** 批量视频生成（异步接口：返回每个轨道新落的 o_video id） */
export async function batchGenerateTrackVideos(body: {
  projectId: string;
  scriptId: string;
  tracks: (TrackGenInput & { prompt: string; durationSec: number })[];
  model: string;
  mode: string;
  resolution: string;
  audio?: boolean;
}): Promise<{ videoId: string; trackId: string }[]> {
  const payload: Record<string, unknown> = {
    projectId: Number(body.projectId),
    scriptId: Number(body.scriptId),
    trackData: body.tracks.map((track) => ({
      trackId: Number(track.trackId),
      uploadData: toInfoItems([track]),
      prompt: track.prompt,
      duration: track.durationSec,
    })),
    model: body.model,
    mode: body.mode,
    resolution: body.resolution,
  };
  if (body.audio != null) payload.audio = body.audio;
  const rows = await postJson<{ videoId: number; trackId: number }[] | null>(
    '/api/production/workbench/batchGenerateVideo',
    payload,
  );
  return (rows ?? []).map((row) => ({ videoId: String(row.videoId), trackId: String(row.trackId) }));
}

// ===== FlowData 整体存档（后端 production/getFlowData + saveFlowData）=====

/**
 * getFlowData 的响应行（两分支形状不同，这里都按可选处理）：
 * - 无存档档：后端现造一个默认 FlowData —— script 来自 `o_script.content`、
 *   assets 来自 `o_assets`、**storyboard 恒为空数组**、scriptPlan/storyboardTable 为空串、
 *   workbench 为 `{videoList: []}`。
 * - 有存档档：把 `o_agentWorkData.data` 的 JSON 原样取出后，**用真实表数据覆盖**
 *   script/assets/storyboard 三段（这正是「写进去读不回来」的由来）。
 * 派生资产生图态在无图时给「未生成」字面量，见 assetGenState 的 imageStateFromStatus。
 */
type FlowDataDeriveRow = {
  id: number;
  assetsId?: number | null;
  name?: string | null;
  type?: string | null;
  prompt?: string | null;
  desc?: string | null;
  /** 后端静态托管小图 URL（无图为 null） */
  src?: string | null;
  /** o_image.state 文案（无图时后端写「未生成」） */
  state?: string | null;
  errorReason?: string | null;
  flowId?: number | null;
};

type FlowDataAssetRow = {
  id: number;
  name?: string | null;
  type?: string | null;
  prompt?: string | null;
  /** o_assets.describe（后端出参改名 desc） */
  desc?: string | null;
  src?: string | null;
  flowId?: number | null;
  derive?: FlowDataDeriveRow[] | null;
};

type FlowDataStoryboardRow = {
  id: number;
  index?: number | null;
  /** o_storyboard.duration（后端换算为 number，无值时为 0） */
  duration?: number | null;
  prompt?: string | null;
  videoDesc?: string | null;
  associateAssetsIds?: number[] | null;
  /** 后端把 filePath 换成小图 URL 后的 src（无图为 null） */
  src?: string | null;
  /** o_storyboard.state 文案 */
  state?: string | null;
  reason?: string | null;
  shouldGenerateImage?: number | null;
  flowId?: number | null;
};

type FlowDataRow = {
  script?: string | null;
  scriptPlan?: string | null;
  storyboardTable?: string | null;
  assets?: FlowDataAssetRow[] | null;
  storyboard?: FlowDataStoryboardRow[] | null;
  /** 后端目前是 todo 桩数据，原样往返 */
  workbench?: Record<string, unknown> | null;
};

function toFlowDataDerive(row: FlowDataDeriveRow): FlowDataDeriveAsset {
  return {
    id: String(row.id),
    assetsId: row.assetsId != null ? String(row.assetsId) : '',
    name: row.name ?? '',
    type: FRONTEND_ASSET_TYPES[row.type ?? ''] ?? 'material',
    prompt: row.prompt ?? '',
    description: row.desc ?? '',
    imageUrl: row.src ? row.src : null,
    imageState: imageStatusFromState(row.state ?? null),
    errorReason: row.errorReason ? row.errorReason : null,
    flowId: row.flowId != null ? String(row.flowId) : null,
  };
}

function toFlowDataAsset(row: FlowDataAssetRow): FlowDataAsset {
  return {
    id: String(row.id),
    name: row.name ?? '',
    type: FRONTEND_ASSET_TYPES[row.type ?? ''] ?? 'material',
    prompt: row.prompt ?? '',
    description: row.desc ?? '',
    imageUrl: row.src ? row.src : null,
    derive: (row.derive ?? []).map(toFlowDataDerive),
    flowId: row.flowId != null ? String(row.flowId) : null,
  };
}

function toFlowDataStoryboard(row: FlowDataStoryboardRow): FlowDataStoryboard {
  return {
    id: String(row.id),
    index: typeof row.index === 'number' ? row.index : null,
    durationSec: row.duration ?? 0,
    prompt: row.prompt ?? '',
    videoDesc: row.videoDesc ?? '',
    associateAssetsIds: (row.associateAssetsIds ?? []).map(String),
    imageUrl: row.src ? row.src : null,
    status: storyboardImageStatusFromState(row.state ?? null),
    errorReason: row.reason ? row.reason : null,
    shouldGenerateImage: row.shouldGenerateImage ?? 0,
    flowId: row.flowId != null ? String(row.flowId) : null,
  };
}

/**
 * 拼出要写回存档的 `storyboard` 数组：**顺序 = 传入的分镜顺序**（也就是用户排好的顺序）。
 *
 * 三个来源各自的短板凑成一份完整行：
 * - 面板分镜（getStoryboardData）永远完整，但只有 id/描述/时长/图片/关联资产；
 * - 存档里的旧行按 id 保留 `videoDesc`/`associateAssetsIds`/`flowId` 等**只有存档才有的字段**
 *   （无存档时这段是空数组，这也是后端默认档的坑）；
 * - 工作台读模型（09 的图片链路）给最新的生图状态，比存档里的旧快照新。
 *
 * 存档里没有的新分镜按后端 addStoryboard 的约定补齐：`videoDesc` 与 `prompt` 同值
 * （08 的契约：两列必须同步，否则 09 的提示词生成读不到输入）、`shouldGenerateImage`
 * 按「有没有图」给（后端 addStoryboard 就是 `src ? 1 : 0`）、关联资产 id 只能给空数组
 * （面板读模型给的是资产**名字**，拿不到 id —— 首次存档时这一点是已知降级，
 * 第二次读存档自愈，因为读侧会用 o_assets2Storyboard 实时覆盖分镜段）。
 */
export function composeFlowStoryboards(
  storyboards: Storyboard[],
  archived: FlowDataStoryboard[],
  imageStates: Workbench['storyboards'] = [],
): FlowDataStoryboard[] {
  const archivedById = new Map(archived.map((row) => [row.id, row]));
  const liveById = new Map(imageStates.map((row) => [row.id, row]));
  return storyboards.map((storyboard, index) => {
    const previous = archivedById.get(storyboard.id);
    const live = liveById.get(storyboard.id);
    return {
      id: storyboard.id,
      // 后端按数组下标回写 o_storyboard.index，这里先按当前顺序标上
      index,
      durationSec: storyboard.durationSec ?? previous?.durationSec ?? 0,
      prompt: storyboard.prompt,
      // 存档里的 videoDesc 可能比描述长（AI 写的视频描述与提示词是两回事），描述没改过就保留；
      // 描述改过则退回「两列同值」——08 的契约，否则 09 的提示词生成会读到旧描述
      videoDesc:
        previous && previous.prompt === storyboard.prompt && previous.videoDesc
          ? previous.videoDesc
          : storyboard.prompt,
      associateAssetsIds: previous?.associateAssetsIds ?? [],
      imageUrl: storyboard.imageUrl ?? previous?.imageUrl ?? null,
      status: live?.status ?? previous?.status ?? 'none',
      errorReason: live?.errorReason ?? previous?.errorReason ?? null,
      shouldGenerateImage: previous?.shouldGenerateImage ?? (storyboard.imageUrl ? 1 : 0),
      flowId: previous?.flowId ?? null,
    };
  });
}

/** 后端 `workbench` 段：解析出 videoList，其余键原样保留（后端结构未定，不假装懂它） */
function toFlowDataWorkbench(row: Record<string, unknown> | null | undefined): FlowDataWorkbench {
  const record = row ?? {};
  return { ...record, videoList: Array.isArray(record.videoList) ? record.videoList : [] };
}

function fromFlowDataDerive(item: FlowDataDeriveAsset): FlowDataDeriveRow {
  return {
    id: Number(item.id),
    assetsId: item.assetsId ? Number(item.assetsId) : null,
    name: item.name,
    type: BACKEND_ASSET_TYPES[item.type as Exclude<AssetType, 'material'>] ?? item.type,
    prompt: item.prompt,
    desc: item.description,
    src: item.imageUrl,
    state: imageStateFromStatus(item.imageState),
    errorReason: item.errorReason,
    flowId: item.flowId != null ? Number(item.flowId) : null,
  };
}

function fromFlowDataAsset(item: FlowDataAsset): FlowDataAssetRow {
  return {
    id: Number(item.id),
    name: item.name,
    type: BACKEND_ASSET_TYPES[item.type as Exclude<AssetType, 'material'>] ?? item.type,
    prompt: item.prompt,
    desc: item.description,
    src: item.imageUrl,
    flowId: item.flowId != null ? Number(item.flowId) : null,
    derive: item.derive.map(fromFlowDataDerive),
  };
}

function fromFlowDataStoryboard(item: FlowDataStoryboard): FlowDataStoryboardRow {
  return {
    id: Number(item.id),
    index: item.index,
    duration: item.durationSec,
    prompt: item.prompt,
    videoDesc: item.videoDesc,
    associateAssetsIds: item.associateAssetsIds.map(Number),
    src: item.imageUrl,
    state: storyboardImageStateFromStatus(item.status),
    reason: item.errorReason,
    shouldGenerateImage: item.shouldGenerateImage,
    flowId: item.flowId != null ? Number(item.flowId) : null,
  };
}

/**
 * 读工作室的整体存档（剧本 + 资产 + 分镜 + 工作数据一次取回）。
 *
 * **后端无存档时不报错**，而是现造默认 FlowData 返回（scriptPlan/storyboardTable 为空串、
 * storyboard 为空数组），所以调用方拿到的一定是形状完整的文档，按默认值渲染即可。
 *
 * 注意 storyboard 段的双重身份：无存档时恒为空数组（不代表没有分镜！），
 * 有存档时才回真实分镜 —— 分镜面板的数据源仍应是 getStoryboardData。
 */
export async function fetchStudioFlowData(
  projectId: string,
  episodesId: string,
  signal?: AbortSignal,
): Promise<StudioFlowData> {
  const row = await postJson<FlowDataRow | null>(
    '/api/production/getFlowData',
    { projectId: Number(projectId), episodesId: Number(episodesId) },
    { signal },
  );
  return {
    script: row?.script ?? '',
    scriptPlan: row?.scriptPlan ?? '',
    storyboardTable: row?.storyboardTable ?? '',
    assets: (row?.assets ?? []).map(toFlowDataAsset),
    storyboard: (row?.storyboard ?? []).map(toFlowDataStoryboard),
    workbench: toFlowDataWorkbench(row?.workbench),
  };
}

/**
 * 写工作室的整体存档。整个文档一起提交（不是增量 patch）。
 *
 * 读侧会实时覆盖 script/assets/storyboard 三段，所以真正被「保存下来」的是
 * `scriptPlan`、`storyboardTable` 与 `storyboard` 的**数组顺序**——写侧按数组下标
 * 回写每条分镜的 `o_storyboard.index`（任一元素缺 id 时这一整步被后端跳过），
 * 而 getStoryboardData 正是按 index 升序读，于是刷新后顺序能还原。
 *
 * 未参与编辑的 `assets`/`workbench` 原样回传：存档 JSON 同时是 AI 工作区的数据源，
 * 丢掉它们等于把工作区文档掏空。
 */
export async function saveStudioFlowData(
  projectId: string,
  episodesId: string,
  data: StudioFlowData,
): Promise<void> {
  await postJson('/api/production/saveFlowData', {
    projectId: Number(projectId),
    episodesId: Number(episodesId),
    data: {
      script: data.script,
      scriptPlan: data.scriptPlan,
      assets: data.assets.map(fromFlowDataAsset),
      storyboardTable: data.storyboardTable,
      storyboard: data.storyboard.map(fromFlowDataStoryboard),
      workbench: data.workbench,
    },
  });
}

/**
 * 轮询到「每个 id 都出现在响应里」为止。
 *
 * 生图 / 视频 / 提示词三条轮询接口的后端行为一致：**只回终态行，进行中的行整条省略**。
 * 所以「缺失」= 仍在生成（而不是像资产提取那样代表被删），必须继续等；
 * 超时是唯一的退出兜底，由调用方按自己的文案抛出。
 */
async function pollUntilAllPresent<T extends { id: string }>(
  ids: string[],
  fetchTick: (signal?: AbortSignal) => Promise<T[]>,
  options: {
    onTick: (rows: T[]) => void;
    intervalMs: number;
    timeoutMs: number;
    timeoutError: () => Error;
  },
  signal?: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  for (;;) {
    const rows = await fetchTick(signal);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    options.onTick(rows);

    const seen = new Set(rows.map((row) => row.id));
    if (ids.every((id) => seen.has(id))) return;

    if (Date.now() - startedAt > options.timeoutMs) throw options.timeoutError();
    await waitForTick(options.intervalMs, signal);
  }
}
