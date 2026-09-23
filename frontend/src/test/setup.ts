import '@testing-library/jest-dom/vitest';

// jsdom 的 AbortSignal 与 Node 内置 undici Request 跨 realm：
// 不带 signal 的请求正常，带 signal 的会被 undici 拒绝（详见 test/jsdomEnv.ts）。
// 恢复自定义环境在 super 前捕获的 Node 原生构造器；Node AbortController abort
// 时 undici 同样抛 DOMException('AbortError')，与浏览器行为一致。
const envGlobals = globalThis as Record<string, unknown>;
if (envGlobals.__NODE_ABORT_CONTROLLER__) {
  globalThis.AbortController = envGlobals.__NODE_ABORT_CONTROLLER__ as typeof AbortController;
  globalThis.AbortSignal = envGlobals.__NODE_ABORT_SIGNAL__ as typeof AbortSignal;
}

// jsdom 未实现 matchMedia，antd 的响应式组件（Table/Descriptions 等）依赖它
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom 未实现 getComputedStyle(elt, pseudoElt)，antd 触发时忽略伪元素参数即可
const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (elt: Element) => originalGetComputedStyle(elt) as CSSStyleDeclaration;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
