import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiProxyTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8080';
const enableProxy = process.env.VITE_ENABLE_PROXY === 'true';

export default defineConfig({
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
