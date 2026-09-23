import type { AssetImageStatus, AssetPromptStatus } from '../types/api';

/**
 * 后端资产 AI 生成状态的中文文案。整数/文案 → 命名状态的翻译只此一份，
 * API 层与 MSW 契约层（backendDb/handlers）共用，禁止页面再裸写中文字符串。
 *
 * 注意后端两条链路的失败文案不统一：
 * - o_assets.promptState：单个润色写「失败」，批量润色异常也写「失败」、
 *   视觉手册缺失写「生成失败」——两种都按 failed 翻译。
 * - o_image.state：生图统一写「生成失败」。
 */
export const PROMPT_STATE = {
  /** 后端 NULL：从未润色 */
  NONE: null,
  RUNNING: '生成中',
  DONE: '已完成',
  /** 单个润色失败 / 批量润色异常 */
  FAILED: '失败',
  /** 批量润色视觉手册缺失等前置失败 */
  FAILED_ALT: '生成失败',
} as const;

export const IMAGE_STATE = {
  /** 后端无 o_image 行（未生成/未上传） */
  NONE: null,
  RUNNING: '生成中',
  DONE: '已完成',
  FAILED: '生成失败',
} as const;

const PROMPT_STATUS_BY_STATE = new Map<string | null, AssetPromptStatus>([
  [PROMPT_STATE.RUNNING, 'running'],
  [PROMPT_STATE.DONE, 'done'],
  [PROMPT_STATE.FAILED, 'failed'],
  [PROMPT_STATE.FAILED_ALT, 'failed'],
  [PROMPT_STATE.NONE, 'none'],
]);

/** 后端 promptState 文案 → 前端命名状态（未知值按未润色兜底） */
export function promptStatusFromState(state: string | null): AssetPromptStatus {
  return PROMPT_STATUS_BY_STATE.get(state) ?? 'none';
}

const IMAGE_STATUS_BY_STATE = new Map<string | null, AssetImageStatus>([
  [IMAGE_STATE.RUNNING, 'running'],
  [IMAGE_STATE.DONE, 'done'],
  [IMAGE_STATE.FAILED, 'failed'],
  [IMAGE_STATE.NONE, 'none'],
]);

/** 后端 o_image.state 文案 → 前端命名状态（未知值按未生成兜底） */
export function imageStatusFromState(state: string | null): AssetImageStatus {
  return IMAGE_STATUS_BY_STATE.get(state) ?? 'none';
}

/** 润色流程进行中，驱动批量润色轮询 */
export function isPromptActive(status: AssetPromptStatus): boolean {
  return status === 'running';
}

/** 生图进行中（后端 o_image 已落占位行），期间可取消 */
export function isImageActive(status: AssetImageStatus): boolean {
  return status === 'running';
}
