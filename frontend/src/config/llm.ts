/**
 * LLM API Configuration
 * 模型配置信息
 */

export const LLM_CONFIG = {
  baseURL: import.meta.env?.VITE_LLM_BASE_URL || 'http://115.190.62.87/dp',
  apiKey: import.meta.env?.VITE_LLM_API_KEY || 'sk-dp-Eh4dBLlwrW2XPb7wT_CH_1t9S-Y_K3z9vN5g',
  model: import.meta.env?.VITE_LLM_MODEL || 'qwen3.6-35b-a3b',
  // 是否启用思考模式
  enableThinking: false,
} as const;

export type LLMConfig = typeof LLM_CONFIG;
