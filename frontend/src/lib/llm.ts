/**
 * LLM API Client
 * 基于 OpenAI 兼容接口的调用封装
 */

import { LLM_CONFIG } from '../config/llm';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  enableThinking?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用 LLM API
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const { messages, model = LLM_CONFIG.model, enableThinking = LLM_CONFIG.enableThinking } = options;

  const requestBody: any = {
    model,
    messages,
  };

  // 如果启用思考模式，添加 chat_template_kwargs
  if (enableThinking) {
    requestBody.chat_template_kwargs = {
      enable_thinking: true,
    };
  }

  const response = await fetch(`${LLM_CONFIG.baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * 简单的单轮对话
 */
export async function simpleChat(
  content: string,
  systemPrompt?: string
): Promise<string> {
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content });

  const response = await chatCompletion({ messages });
  return response.choices[0].message.content;
}
