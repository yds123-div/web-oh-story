/** 前端"项目" ↔ 后端 `o_project`；后端 id 为 number（Date.now()），对外统一转 string */
export type Project = {
  id: string;
  name: string;
  /** 故事类型（如 女频-轻小说） */
  type: string;
  /** 项目类型：script=剧本 / novel=小说（前端只开放剧本模式） */
  projectType: string;
  /** 项目简介 */
  intro: string;
  /** 视频风格 */
  artStyle: string;
  /** 导演手册（P2，暂存空串） */
  directorManual: string;
  /** 画面比例 */
  videoRatio: string;
  imageModel: string;
  videoModel: string;
  imageQuality: string;
  /** 生成模式（后端默认 text） */
  mode: string;
  /** 创建时间（后端为 number 时间戳，翻译为 ISO 字符串） */
  createTime: string;
};

export type ProjectListResponse = {
  projects: Project[];
};

/** 后端 `/api/general/generalStatistics` 返回的计数 */
export type ProjectStatistics = {
  roleCount: number;
  scriptCount: number;
  videoCount: number;
  storyboardCount: number;
};

/**
 * 新建项目 body —— 与后端 addProject 的 12 个必填字段一一对应。
 * projectType/directorManual/mode 不由表单提供、由 API client 固定（剧本模式）。
 */
export type CreateProjectBody = {
  name: string;
  type: string;
  artStyle: string;
  videoRatio: string;
  imageModel: string;
  videoModel: string;
  imageQuality: string;
  intro?: string;
};

// ---- 任务（后端 o_tasks）----

export type TaskStateName = 'running' | 'succeeded' | 'failed';

/** 任务中心一行；后端 state 中文（进行中/已完成/生成失败）翻译为 TaskStateName */
export type TaskRecord = {
  projectId: string | null;
  projectName: string | null;
  taskClass: string;
  relatedObjects: string | null;
  model: string | null;
  describe: string;
  state: TaskStateName;
  /** 后端原始 state 文案（进行中/已完成/生成失败） */
  stateText: string;
  startTime: string | null;
  reason: string | null;
};

export type TaskListParams = {
  state?: TaskStateName;
  taskClass?: string;
  projectId?: string;
  page: number;
  limit: number;
};

export type TaskListResponse = {
  tasks: TaskRecord[];
  total: number;
};

/** 分类/项目下拉选项 */
export type TaskOption = { id: string; name: string };


export type CreditsResponse = {
  balance: number;
};

export type TaskStatusName = 'pending' | 'running' | 'succeeded' | 'failed';

export type TaskStatus = {
  taskId: string;
  status: TaskStatusName;
  progress: number;
  result?: unknown;
  error?: string;
};

export type SubmitTaskResponse = {
  taskId: string;
};

export type OutlineTaskBody = {
  sourceType: 'paste' | 'file';
  text?: string;
  fileName?: string;
};

export type NovelTaskBody = {
  sourceType: 'paste' | 'file';
  text?: string;
  fileName?: string;
};

export type WorkflowStep = 1 | 2 | 3;

export type WorkflowState = {
  projectId: string;
  unlockedStep: WorkflowStep;
  outlineFinalized: boolean;
  assetsCompleted: boolean;
};

export type OutlineSetting = {
  videoStyle: string;
  aspectRatio: string;
  resolution: string;
  model: string;
};

export type OutlineSummary = {
  protagonists: string;
  genre: string;
  synopsis: string;
  background: string;
  setting: string;
};

export type AssetType = 'character' | 'scene' | 'prop' | 'material';

export type AssetAlt = {
  name: string;
  imageUrl: string;
  filter?: string;
};

export type Asset = {
  id: string;
  projectId: string;
  type: AssetType;
  name: string;
  role: string;
  description: string;
  imageUrl: string | null;
  emoji: string | null;
  consistencyLocked: boolean;
  status: 'pending' | 'ready';
  alts?: AssetAlt[];
  currentAlt?: number;
  refs?: string[];
};

export type Outline = {
  projectId: string;
  projectName: string;
  finalized: boolean;
  setting: OutlineSetting;
  summary: OutlineSummary;
  extractedAssets: Asset[];
  screenplayTitle: string;
  screenplay: string;
};

export type EpisodeSegmentSummary = {
  no: number;
  title: string;
  durationSec: number;
};

export type Episode = {
  id: string;
  projectId: string;
  number: number;
  title: string;
  status: 'split' | 'draft';
  segmentCount: number;
  durationSec: number;
  coverUrl: string | null;
  summary: string;
  segments: EpisodeSegmentSummary[];
};

export type AssetListResponse = {
  assets: Asset[];
};

export type EpisodeListResponse = {
  episodes: Episode[];
};

export type ModelId = 'seedance-2.5' | 'minimax-h3-max' | 'wan-3.0';

export type Model = {
  id: ModelId;
  name: string;
};

export type ModelListResponse = {
  models: Model[];
};

export type Shot = {
  id: string;
  durationSec: number;
  shotType: string;
  camera: string;
  action: string;
  speaker: string;
  voice: string;
  line: string;
};

export type Segment = {
  id: string;
  episodeId: string;
  projectId: string;
  no: number;
  title: string;
  durationSec: number;
  generated: boolean;
  videoUrl: string | null;
  prompt: string;
  shots: Shot[];
  model: ModelId | null;
  charCount: number;
};

export type SegmentListResponse = {
  segments: Segment[];
};

export type PatchSegmentBody = {
  prompt?: string;
  shots?: Shot[];
  title?: string;
};

export type CreateSegmentBody = {
  prompt: string;
  durationSec: number;
  title: string;
};

export type VideoTaskBody = {
  model: ModelId;
};

export type ExportTaskBody = {
  resolution?: string;
  format?: string;
  watermark?: string;
};

export type Template = {
  id: string;
  name: string;
  subtitle: string;
  tags: string[];
  coverUrl: string;
  coverFilter: string;
  scriptText: string;
  style: string;
  aspectRatio: string;
};

export type TemplateListResponse = {
  templates: Template[];
};

export type AppNotification = {
  id: string;
  icon: string;
  title: string;
  time: string;
  read: boolean;
};

export type NotificationListResponse = {
  notifications: AppNotification[];
};

export type PlazaAssetCategory = 'character' | 'scene' | 'video' | 'material';

export type PlazaAsset = {
  id: string;
  category: PlazaAssetCategory;
  name: string;
  imageUrl: string | null;
  videoUrl: string | null;
  height: number;
  meta: string;
  tag: 'ai' | 'upload';
  filter?: string;
};

export type PlazaCategory = 'all' | 'character' | 'scene' | 'video' | 'material' | 'upload';
