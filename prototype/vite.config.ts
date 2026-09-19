import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PROTOTYPE — throwaway。端口避开 5173（本机 Opik 占用）。
export default defineConfig({
  plugins: [react()],
  server: { port: 5301, strictPort: true, fs: { allow: ['..'] } },
});
