import { describe, it, expect } from 'vitest';
import {
  IMAGE_STATE,
  PROMPT_STATE,
  imageStatusFromState,
  isPromptActive,
  promptStatusFromState,
} from './assetGenState';

describe('assetGenState 状态翻译表（后端中文文案 → 命名状态）', () => {
  describe('promptStatusFromState', () => {
    it('润色各阶段文案正确翻译', () => {
      expect(promptStatusFromState(PROMPT_STATE.NONE)).toBe('none');
      expect(promptStatusFromState(PROMPT_STATE.RUNNING)).toBe('running');
      expect(promptStatusFromState(PROMPT_STATE.DONE)).toBe('done');
    });

    it('后端两种失败文案（失败/生成失败）都翻译为 failed', () => {
      expect(promptStatusFromState(PROMPT_STATE.FAILED)).toBe('failed');
      expect(promptStatusFromState(PROMPT_STATE.FAILED_ALT)).toBe('failed');
    });

    it('未知文案按未润色兜底', () => {
      expect(promptStatusFromState('随便什么')).toBe('none');
    });
  });

  describe('imageStatusFromState', () => {
    it('生图各阶段文案正确翻译', () => {
      expect(imageStatusFromState(IMAGE_STATE.NONE)).toBe('none');
      expect(imageStatusFromState(IMAGE_STATE.RUNNING)).toBe('running');
      expect(imageStatusFromState(IMAGE_STATE.DONE)).toBe('done');
      expect(imageStatusFromState(IMAGE_STATE.FAILED)).toBe('failed');
    });

    it('未知文案按未生成兜底', () => {
      expect(imageStatusFromState('异常值')).toBe('none');
    });
  });

  it('isPromptActive：只有 running 驱动轮询', () => {
    expect(isPromptActive('running')).toBe(true);
    expect(isPromptActive('none')).toBe(false);
    expect(isPromptActive('done')).toBe(false);
    expect(isPromptActive('failed')).toBe(false);
  });
});
