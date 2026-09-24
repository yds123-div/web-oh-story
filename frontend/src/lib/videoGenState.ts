import type { StoryboardImageStatus, VideoPromptStatus, VideoStatus } from '../types/api';

/**
 * 分镜图片 / 视频轨道 / 视频生成状态的中文文案。文案 → 命名状态的翻译只此一份，
 * API 层与 MSW 契约层（backendDb/handlers）共用，禁止页面再裸写中文字符串。
 *
 * 为什么不复用 `assetGenState.ts` 的表：那里描述的是 `o_image.state`（资产生图），
 * 这里是 `o_storyboard.state`（分镜生图）——文案恰好一样，但落在不同的表上，
 * 合并会让「改资产链路」误伤「分镜链路」。两条链路的 NONE 也不同
 * （o_image 用 NULL 表示无行，o_storyboard 用「未生成」字面量）。
 */
export const STORYBOARD_IMAGE_STATE = {
  NONE: '未生成',
  RUNNING: '生成中',
  DONE: '已完成',
  FAILED: '生成失败',
} as const;

/** `o_videoTrack.state`（视频提示词生成态）；NULL = 从未生成 */
export const VIDEO_PROMPT_STATE = {
  NONE: null,
  RUNNING: '生成中',
  DONE: '已完成',
  FAILED: '生成失败',
} as const;

/**
 * `o_video.state`（视频生成态）。后端两条读路径文案不一致：
 * 写侧（generateVideo/batchGenerateVideo）写「生成成功」，
 * 而 `getGenerateData` 的 videoList 用 `state === '已完成'` 判成功 ——
 * 成功视频经那条路径会掉成「未生成」。两种文案都按 done 翻译，调用方不受影响。
 */
export const VIDEO_STATE = {
  NONE: null,
  RUNNING: '生成中',
  DONE: '生成成功',
  DONE_ALT: '已完成',
  FAILED: '生成失败',
} as const;

const STORYBOARD_IMAGE_STATUS_BY_STATE = new Map<string | null, StoryboardImageStatus>([
  [STORYBOARD_IMAGE_STATE.RUNNING, 'running'],
  [STORYBOARD_IMAGE_STATE.DONE, 'done'],
  [STORYBOARD_IMAGE_STATE.FAILED, 'failed'],
  [STORYBOARD_IMAGE_STATE.NONE, 'none'],
]);

/** 后端 o_storyboard.state 文案 → 前端命名状态（未知值按未生成兜底） */
export function storyboardImageStatusFromState(state: string | null): StoryboardImageStatus {
  return STORYBOARD_IMAGE_STATUS_BY_STATE.get(state) ?? 'none';
}

const VIDEO_PROMPT_STATUS_BY_STATE = new Map<string | null, VideoPromptStatus>([
  [VIDEO_PROMPT_STATE.RUNNING, 'running'],
  [VIDEO_PROMPT_STATE.DONE, 'done'],
  [VIDEO_PROMPT_STATE.FAILED, 'failed'],
  [VIDEO_PROMPT_STATE.NONE, 'none'],
]);

/** 后端 o_videoTrack.state 文案 → 前端命名状态（未知值按未生成兜底） */
export function videoPromptStatusFromState(state: string | null): VideoPromptStatus {
  return VIDEO_PROMPT_STATUS_BY_STATE.get(state) ?? 'none';
}

const VIDEO_STATUS_BY_STATE = new Map<string | null, VideoStatus>([
  [VIDEO_STATE.RUNNING, 'running'],
  [VIDEO_STATE.DONE, 'done'],
  [VIDEO_STATE.DONE_ALT, 'done'],
  [VIDEO_STATE.FAILED, 'failed'],
  [VIDEO_STATE.NONE, 'none'],
]);

/** 后端 o_video.state 文案 → 前端命名状态（未知值按未生成兜底） */
export function videoStatusFromState(state: string | null): VideoStatus {
  return VIDEO_STATUS_BY_STATE.get(state) ?? 'none';
}
