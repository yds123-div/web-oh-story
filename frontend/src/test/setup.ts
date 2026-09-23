import '@testing-library/jest-dom/vitest';

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
