import type { ScriptExtractStatus } from '../types/api';

/**
 * 后端 o_script.extractState 整数语义。整数→命名状态的翻译只此一份，
 * API 层与 MSW 契约层（backendDb/handlers）共用，禁止再裸写 2/0/1/-1。
 */
export const EXTRACT_STATE = {
  /** 后端 NULL：手动新增、从未提取 */
  NONE: null,
  /** 2：已受理，等待后台提取 */
  WAITING: 2,
  /** 0：AI 正在提取 */
  EXTRACTING: 0,
  /** 1：提取成功，资产已入库 */
  DONE: 1,
  /** -1：提取失败 */
  FAILED: -1,
} as const;

const STATUS_BY_STATE = new Map<number | null, ScriptExtractStatus>([
  [EXTRACT_STATE.DONE, 'done'],
  [EXTRACT_STATE.WAITING, 'waiting'],
  [EXTRACT_STATE.EXTRACTING, 'extracting'],
  [EXTRACT_STATE.FAILED, 'failed'],
  [EXTRACT_STATE.NONE, 'none'],
]);

/** 后端整数状态 → 前端命名状态（未知值按未提取兜底） */
export function extractStatusFromState(state: number | null): ScriptExtractStatus {
  return STATUS_BY_STATE.get(state) ?? 'none';
}

/** 提取流程进行中（等待 / 提取中），驱动轮询 */
export function isExtractionActive(status: ScriptExtractStatus): boolean {
  return status === 'waiting' || status === 'extracting';
}

/** 可发起提取（从未提取 / 上次失败，可重试） */
export function canExtract(status: ScriptExtractStatus): boolean {
  return status === 'none' || status === 'failed';
}
