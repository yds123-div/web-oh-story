/**
 * LLM API 测试文件
 * 运行: npx tsx src/lib/llm.test.ts
 */

import { simpleChat, chatCompletion } from './llm';

async function testSimpleChat() {
  console.log('测试简单对话...');
  try {
    const response = await simpleChat('你好，请用一句话介绍你自己');
    console.log('✅ 简单对话成功:', response);
  } catch (error) {
    console.error('❌ 简单对话失败:', error);
  }
}

async function testChatCompletion() {
  console.log('\n测试完整对话...');
  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个有帮助的助手' },
        { role: 'user', content: '什么是 2+2?' },
      ],
    });
    console.log('✅ 完整对话成功:', response.choices[0].message.content);
    console.log('Token 使用:', response.usage);
  } catch (error) {
    console.error('❌ 完整对话失败:', error);
  }
}

async function testThinkingMode() {
  console.log('\n测试思考模式...');
  try {
    const response = await chatCompletion({
      messages: [
        { role: 'user', content: '解释一下什么是量子计算' },
      ],
      enableThinking: true,
    });
    console.log('✅ 思考模式成功:', response.choices[0].message.content);
    console.log('Token 使用:', response.usage);
  } catch (error) {
    console.error('❌ 思考模式失败:', error);
  }
}

async function runTests() {
  await testSimpleChat();
  await testChatCompletion();
  await testThinkingMode();
}

runTests();
