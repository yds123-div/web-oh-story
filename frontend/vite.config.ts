import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiProxyTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8080';
const enableProxy = process.env.VITE_ENABLE_PROXY === 'true';

export default defineConfig({
  // 外网经 nginx 路径代理部署时设置（服务器 compose 传入 VITE_BASE=/deepsfv-dev/）
  base: process.env.VITE_BASE ?? '/',
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
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
