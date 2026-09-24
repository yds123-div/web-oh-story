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

/**
 * 资产提示词 AI 润色状态（后端 `o_assets.promptState` 中文文案在 API 层翻译后的命名状态）：
 * none=从未润色（后端为 NULL）、running=生成中、done=已完成、failed=润色失败
 * （后端两种失败文案「失败」/「生成失败」都翻译为 failed）
 */
export type AssetPromptStatus = 'none' | 'running' | 'done' | 'failed';

/**
 * 资产图片生成状态（后端 `o_image.state` 中文文案翻译）：none=无图片记录、
 * running=生成中、done=已完成、failed=生成失败
 */
export type AssetImageStatus = 'none' | 'running' | 'done' | 'failed';

/**
 * 资产（后端 `o_assets` join `o_image` 行的翻译形态）。
 * 后端 type 枚举只有 role/scene/tool；素材（material）无后端对应，
 * 仅作为旧页面残留的前端概念保留在枚举里。
 */
export type Asset = {
  id: string;
  projectId: string;
  type: AssetType;
  name: string;
  description: string;
  /** 后端静态托管图片 URL（getAssetsApi 的 src 翻译）；未生成/未上传为 null */
  imageUrl: string | null;
  /** 生图提示词（o_assets.prompt，AI 润色/生图用） */
  prompt: string | null;
  /** 备注（o_assets.remark） */
  remark: string | null;
  /** 提示词润色状态（o_assets.promptState 翻译） */
  promptState: AssetPromptStatus;
  /** 润色失败原因（o_assets.promptErrorReason） */
  promptErrorReason: string | null;
  /** 当前关联的 o_image 行 id（生图占位记录，取消生图用）；未生成/未上传为 null */
  imageId: string | null;
  /** 图片生成状态（o_image.state 翻译） */
  imageState: AssetImageStatus;
};

export type AssetListResponse = {
  assets: Asset[];
  /** 后端分页 total（父资产数） */
  total: number;
};

/** 新增资产 body（对应后端 addAssets；material 无后端类型，边界上排除） */
export type CreateAssetBody = {
  projectId: string;
  type: Exclude<AssetType, 'material'>;
  name: string;
  description: string;
  prompt?: string;
};

/** 更新资产 body（对应后端 updateAssets：id/name/describe 必填，prompt/remark 原样回传避免被清空） */
export type UpdateAssetBody = {
  id: string;
  name: string;
  description: string;
  prompt?: string | null;
  remark?: string | null;
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

/**
 * 分集 = 一个后端剧本（`o_script`）+ 该剧本下分镜的聚合。
 * 后端没有"集"这个实体（领域映射：剧本即分集），集数就是剧本按 id 升序的序号。
 */
export type Episode = {
  /** 即后端 scriptId，工作室页路由的 :episodeId 复用它 */
  id: string;
  projectId: string;
  /** 集数（剧本按 id 升序的序号，从 1 开始） */
  number: number;
  title: string;
  /** 该剧本的分镜数 */
  storyboardCount: number;
  /** 分镜总时长（秒）；分镜无时长记 0 */
  durationSec: number;
  /** 封面：第一个有缩略图的分镜图；无分镜或无图为 null */
  coverUrl: string | null;
};

export type EpisodeListResponse = {
  episodes: Episode[];
};

// ---- 分镜（后端 o_storyboard）----

/** 分镜关联资产（后端 getStoryboardData 的 characters 项；type 为后端 role/scene/tool 翻译） */
export type StoryboardCharacter = {
  name: string;
  type: AssetType;
  /** 资产缩略图 URL；资产尚未生图/上传为 null */
  avatarUrl: string | null;
};

/**
 * 分镜（读模型 = `/api/production/getStoryboardData`）。
 * 后端该接口只回 prompt/duration/filePath/characters/index ——
 * 不含 videoDesc 与 state（state 是图片生成态，由 09 的轮询接口给）。
 */
export type Storyboard = {
  id: string;
  scriptId: string;
  /** 分镜描述（新增/编辑写 o_storyboard.prompt） */
  prompt: string;
  /** 时长（秒）；后端未记录为 null */
  durationSec: number | null;
  /** 缩略图（后端静态托管小图）；未生成为 null */
  imageUrl: string | null;
  /** 关联资产 */
  characters: StoryboardCharacter[];
};

/**
 * 新增分镜 body（后端 addStoryboard，落库时同时建一条 o_videoTrack）。
 * 后端无"景别/运镜"列，两者由页面拼进 prompt 文本。
 */
export type CreateStoryboardBody = {
  projectId: string;
  scriptId: string;
  /** 分镜描述（API 层同时写入 o_storyboard.prompt 与 videoDesc 两列） */
  prompt: string;
  durationSec: number;
};

/** 更新分镜 body（后端 editStoryboardInfo：prompt 与 videoDesc 必须同时给出、整行覆盖） */
export type UpdateStoryboardBody = {
  id: string;
  prompt: string;
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

// ---- 剧本（后端 o_script）----

/**
 * 剧本提取状态（API 层按后端 extractState 整数翻译后的命名状态）：
 * none=未提取（手动新增，后端为 NULL）、waiting=等待提取、extracting=提取中、
 * done=提取成功、failed=提取失败
 */
export type ScriptExtractStatus = 'none' | 'waiting' | 'extracting' | 'done' | 'failed';

/** 后端 `o_script` 表一行 */
export type Script = {
  id: string;
  projectId: string;
  name: string;
  content: string;
  extractStatus: ScriptExtractStatus;
  /** 提取失败原因（extractStatus='failed' 时有值） */
  errorReason: string | null;
  /** 创建时间（后端为 number 时间戳，翻译为 ISO 字符串） */
  createTime: string;
};

export type ScriptListResponse = {
  scripts: Script[];
};

/** 新增剧本 body */
export type AddScriptBody = {
  projectId: string;
  name: string;
  content: string;
};

/** pollScriptAssets 返回的单剧本提取状态（整数 extractState 同样在 API 层翻译） */
export type ScriptExtractState = {
  id: string;
  extractStatus: ScriptExtractStatus;
  errorReason: string | null;
};

/** 更新剧本 body（后端 updateScript 四字段全必填，前端无剧本-资产关联编辑，assets 恒发空数组=不动关联） */
export type UpdateScriptBody = {
  id: string;
  name: string;
  content: string;
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
