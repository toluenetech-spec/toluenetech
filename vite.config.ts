import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const workerTarget = env.VITE_WORKER_URL || 'http://127.0.0.1:8787';
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: true,
        proxy: {
          // Proxy all Worker API routes to wrangler dev (port 8787) so both
          // public and admin requests hit the Worker in dev instead of Vite.
          '/cms': workerTarget,
          '/leads': workerTarget,
          '/media': workerTarget,
          '/files': workerTarget,
          '/assistant': workerTarget,
          '/ai-lab': workerTarget,
          '/auth': workerTarget,
          '/client': workerTarget,
          '/admin': workerTarget,
          '/healthz': workerTarget,
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
