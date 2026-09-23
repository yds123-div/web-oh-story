/**
 * 新建项目的表单选项——与后端 addProject 的必填字段一一对应。
 * 模型选项为后端生态常用的供应商模型名（真实可选列表待后端供应商配置体系开放后接入）。
 */

export const PROJECT_TYPE_OPTIONS = [
  { value: '女频-轻小说', label: '女频-轻小说' },
  { value: '穿越宿命', label: '穿越宿命' },
  { value: '热血战斗', label: '热血战斗' },
  { value: '悬疑推理', label: '悬疑推理' },
];

export const ART_STYLE_OPTIONS = [
  { value: '赛博朋克电影', label: '赛博朋克电影' },
  { value: '国漫写实', label: '国漫写实' },
  { value: '赛璐璐动画', label: '赛璐璐动画' },
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
  artStyle: '赛博朋克电影',
  videoRatio: '9:16',
  imageModel: 'Seedream-4.0',
  videoModel: 'Seedance 2.0',
  imageQuality: '2K',
} as const;
