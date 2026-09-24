import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // .env 里的值不会自动进入本文件的 process.env，需用 loadEnv 读取
  const env = loadEnv(mode, __dirname, '');

  // 开发代理默认开启、指向后端真实端口（VITE_ENABLE_PROXY=false 可关闭）
  const enableProxy = env.VITE_ENABLE_PROXY !== 'false';
  const apiProxyTarget = env.VITE_API_PROXY ?? 'http://localhost:10588';

  return {
    // 外网经 nginx 路径代理部署时设置（服务器 compose 传入 VITE_BASE=/deepsfv-dev/）
    base: env.VITE_BASE ?? '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: enableProxy
        ? {
            '/api': {
              target: apiProxyTarget,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    test: {
      // 自定义 jsdom 环境：修复 AbortSignal 与 Node undici Request 的跨 realm 冲突
      environment: './src/test/jsdomEnv.ts',
      globals: true,
      setupFiles: './src/test/setup.ts',
      // lib/llm.test.ts 是 npx tsx 手动运行的真实 LLM 冒烟脚本（非 vitest 套件）
      exclude: [...configDefaults.exclude, '**/src/lib/llm.test.ts'],
      // 页面级用例会走真实的轮询节奏（生图 2.5s、提示词 3s、视频 5s 一拍），
      // 默认 5s 单测超时不够——超时值放宽，不缩短生产用的轮询间隔
      testTimeout: 30_000,
    },
  };
});
