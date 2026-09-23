import { builtinEnvironments } from 'vitest/environments';

/**
 * jsdom 自带 AbortController/AbortSignal 并在环境 setup 时覆盖全局，
 * 但 jsdom 不提供 Request —— MSW node 拦截器用 Node 内置 undici 的 Request
 * 重新构造请求时，undici 只认 Node realm 的 AbortSignal（brand check），
 * 带 jsdom signal 的请求会抛：
 *   TypeError: RequestInit: Expected signal ... to be an instance of AbortSignal
 * 这里在 jsdom setup（全局被覆盖）之前捕获 Node 原生构造器并注入全局，
 * 供 test/setup.ts 恢复。真实浏览器不存在跨 realm 问题。
 */
export default {
  name: 'jsdom-node-abort',
  transformMode: 'web',
  async setup(global: Record<string, unknown>, options: unknown) {
    const nodeAbortController = global.AbortController;
    const nodeAbortSignal = global.AbortSignal;
    const result = await builtinEnvironments.jsdom.setup(global, options as never);
    global.__NODE_ABORT_CONTROLLER__ = nodeAbortController;
    global.__NODE_ABORT_SIGNAL__ = nodeAbortSignal;
    return result;
  },
};
