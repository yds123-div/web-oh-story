import { apiFetch } from './http';
import type {
  Asset,
  AssetListResponse,
  CreateProjectBody,
  CreateSegmentBody,
  CreditsResponse,
  Episode,
  EpisodeListResponse,
  ExportTaskBody,
  ModelListResponse,
  NotificationListResponse,
  NovelTaskBody,
  Outline,
  OutlineTaskBody,
  PatchSegmentBody,
  Project,
  ProjectListResponse,
  ProjectStatistics,
  Segment,
  SegmentListResponse,
  SubmitTaskResponse,
  TaskListParams,
  TaskListResponse,
  TaskOption,
  TaskRecord,
  TaskStateName,
  TaskStatus,
  TemplateListResponse,
  VideoTaskBody,
  WorkflowState,
} from '../types/api';

/**
 * 后端全部接口为 POST + JSON body + `{code, data, message}` 信封，
 * REST 动词 / 路径参数 / 字段映射 / id 数字↔字符串 的翻译全部收敛在本模块内。
 */
async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
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
export async function fetchProject(id: string): Promise<Project> {
  const rows = await postJson<ProjectRow[]>('/api/general/getSingleProject', { id: Number(id) });
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

export function getOutline(projectId: string): Promise<Outline> {
  return apiFetch(`/api/projects/${projectId}/outline`);
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

export function getWorkflow(projectId: string): Promise<WorkflowState> {
  return apiFetch(`/api/projects/${projectId}/workflow`);
}

export function listAssets(projectId: string): Promise<AssetListResponse> {
  return apiFetch(`/api/projects/${projectId}/assets`);
}

export function submitAssetImageTask(assetId: string): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/assets/${assetId}/image-tasks`, { method: 'POST' });
}

export function patchAsset(assetId: string, body: { consistencyLocked?: boolean; currentAlt?: number }): Promise<Asset> {
  return apiFetch(`/api/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function completeAssets(projectId: string): Promise<WorkflowState> {
  return apiFetch(`/api/projects/${projectId}/assets/complete`, { method: 'POST' });
}

export function submitEpisodeSplitTask(projectId: string): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/projects/${projectId}/episode-split-tasks`, { method: 'POST' });
}

export function listEpisodes(projectId: string): Promise<EpisodeListResponse> {
  return apiFetch(`/api/projects/${projectId}/episodes`);
}

export function getEpisode(episodeId: string): Promise<Episode> {
  return apiFetch(`/api/episodes/${episodeId}`);
}

export function listSegments(episodeId: string): Promise<SegmentListResponse> {
  return apiFetch(`/api/episodes/${episodeId}/segments`);
}

export function patchSegment(segmentId: string, body: PatchSegmentBody): Promise<Segment> {
  return apiFetch(`/api/segments/${segmentId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function createSegment(episodeId: string, body: CreateSegmentBody): Promise<Segment> {
  return apiFetch(`/api/episodes/${episodeId}/segments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitSegmentVideoTask(segmentId: string, body: VideoTaskBody): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/segments/${segmentId}/video-tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function submitEpisodeExportTask(episodeId: string, body: ExportTaskBody = {}): Promise<SubmitTaskResponse> {
  return apiFetch(`/api/episodes/${episodeId}/export-tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listModels(): Promise<ModelListResponse> {
  return apiFetch('/api/models');
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
