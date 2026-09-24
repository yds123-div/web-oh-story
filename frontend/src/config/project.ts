/**
 * 新建项目的表单选项——与后端 addProject 的必填字段一一对应。
 *
 * 两条 value 的硬约束（都是后端契约，不是展示偏好）：
 * 1. artStyle 的 value 是后端视觉手册目录名（data/skills/art_skills/<value>），
 *    label 仅用于展示；润色等 AI 能力按 value 查手册，发中文名会「视觉手册未定义」。
 * 2. imageModel / videoModel 必须是 `<供应商id>:<模型名>`。后端
 *    `u.Ai.Image/Video(key)` 会把 key 按冒号切成 [vendorId, modelName] 再查
 *    o_vendorConfig，裸名（如 "Seedream-4.0"）会直接报「未找到供应商配置 id=X」。
 *
 * 模型选项仍是前端写死的短名单：后端有 modelSelect/getModelList 能列出真实可用模型，
 * 但需要项目里已配好带前缀的模型名才能对上，等设置页（P2）开放后改为动态拉取。
 */

export const PROJECT_TYPE_OPTIONS = [
  { value: '女频-轻小说', label: '女频-轻小说' },
  { value: '穿越宿命', label: '穿越宿命' },
  { value: '热血战斗', label: '热血战斗' },
  { value: '悬疑推理', label: '悬疑推理' },
];

/** 与后端 data/skills/art_skills 下的风格目录一一对应（value=目录名） */
export const ART_STYLE_OPTIONS = [
  { value: '2D_90s_japanese_anime', label: '2D · 90年代日漫' },
  { value: '2D_chinese_guofeng', label: '2D · 国风' },
  { value: '2D_flat_design', label: '2D · 扁平插画' },
  { value: '2D_mature_urban_romance', label: '2D · 都市成熟言情' },
  { value: '3D_anime_render', label: '3D · 动漫渲染' },
  { value: '3D_chinese_traditional', label: '3D · 古风传统' },
  { value: '3D_clay_stopmotion', label: '3D · 黏土定格' },
  { value: '3D_guofeng_cyber', label: '3D · 国风赛博' },
  { value: 'realpeople_ancient_chinese', label: '真人 · 古风' },
  { value: 'realpeople_modern_city', label: '真人 · 现代都市' },
  { value: 'realpeople_urban_modern', label: '真人 · 都市摩登' },
];

export const VIDEO_RATIO_OPTIONS = [
  { value: '9:16', label: '📱 9:16 竖屏' },
  { value: '16:9', label: '16:9 横屏' },
];

/** 图像模型：目前只有自建 Z-Image-Turbo 一个供应商配好了 key */
export const IMAGE_MODEL_OPTIONS = [{ value: 'dp:z-image-turbo', label: 'Z-Image-Turbo' }];

/**
 * 视频模型：全部未配 key（调用会以「缺少API Key」失败，属预期）。
 * 仍列真实可用的 `<供应商>:<模型名>`，key 一到位无需改代码即可产出成片。
 * 默认那条还有额外好处：模型名命中 `seedance.*2-0`，后端会挑
 * data/modelPrompt/video/seedance2Multi-parameterMode.md 当提示词模板，
 * 而不是回退到通用的 o_prompt 文档。
 */
export const VIDEO_MODEL_OPTIONS = [
  { value: 'volcengine:doubao-seedance-2-0-260128', label: 'Seedance 2.0 · 火山引擎' },
  { value: 'volcengine:doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast · 火山引擎' },
  { value: 'klingai:kling-v3-omni:pro', label: 'Kling V3 Omni · 可灵' },
];

/**
 * 生成尺寸。只留 1K / 2K：图像服务的长边上限就是 2048，选 4K 会拿到和 2K 完全一样的图
 * （4K 与 1080P 已从选项里去掉，避免"可见但无效"）。value 直接当后端 ImageConfig.size 用。
 */
export const IMAGE_QUALITY_OPTIONS = [
  { value: '1K', label: '1K（约 576×1024，快）' },
  { value: '2K', label: '2K（约 1152×2048，慢）' },
];

/**
 * 视频生成分辨率。后端 `o_project` 没有这一列（分辨率由视频模型自身的
 * durationResolutionMap 决定），而 generateVideo 的 zod 又要求必填，
 * 故先给一个通用默认值——各供应商模板对不认识的取值都有兜底
 * （如 atlascloud 的 normalizeResolution 会回落到 720p）。
 * 等设置页（P2）能从模型详情读到 durationResolutionMap 再改成动态取值。
 */
export const VIDEO_RESOLUTION = '720p';

/**
 * 生成视频时的兜底时长（秒）。轨道与分镜都没记时长时用它，
 * 也作为轨道时长输入框的默认显示值——`generateVideo` 的 zod 要求 duration 必填。
 */
export const DEFAULT_VIDEO_DURATION_SEC = 4;

/** 各字段的表单默认值（首页与创作页共用） */
export const DEFAULT_PROJECT_FORM = {
  type: '女频-轻小说',
  artStyle: '2D_90s_japanese_anime',
  videoRatio: '9:16',
  imageModel: 'dp:z-image-turbo',
  videoModel: 'volcengine:doubao-seedance-2-0-260128',
  imageQuality: '2K',
} as const;
