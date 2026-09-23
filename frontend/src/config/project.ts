/**
 * 新建项目的表单选项——与后端 addProject 的必填字段一一对应。
 * 视频风格的 value 是后端视觉手册目录名（data/skills/art_skills/<value>），
 * label 仅用于展示；润色等 AI 能力按 value 查手册，发中文名会「视觉手册未定义」。
 * 模型选项为后端生态常用的供应商模型名（真实可选列表待后端供应商配置体系开放后接入）。
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

export const IMAGE_MODEL_OPTIONS = [
  { value: 'Seedream-4.0', label: 'Seedream-4.0' },
  { value: 'Seedream-5.0', label: 'Seedream-5.0' },
  { value: 'Nano Banana Pro', label: 'Nano Banana Pro' },
  { value: 'GPT Image 2', label: 'GPT Image 2' },
];

export const VIDEO_MODEL_OPTIONS = [
  { value: 'Seedance 2.0', label: 'Seedance 2.0' },
  { value: 'Seedance 2.0 Fast', label: 'Seedance 2.0 Fast' },
  { value: 'MiniMax-Hailuo 2.3', label: 'MiniMax-Hailuo 2.3' },
  { value: 'Kling V3 Omni', label: 'Kling V3 Omni' },
];

export const IMAGE_QUALITY_OPTIONS = [
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
  { value: '1080P', label: '1080P' },
];

/** 各字段的表单默认值（首页与创作页共用） */
export const DEFAULT_PROJECT_FORM = {
  type: '女频-轻小说',
  artStyle: '2D_90s_japanese_anime',
  videoRatio: '9:16',
  imageModel: 'Seedream-4.0',
  videoModel: 'Seedance 2.0',
  imageQuality: '2K',
} as const;
