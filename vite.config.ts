import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      /** Keep Vite off 3000 so `npm run dev` (Next in frontend/) can bind 3000 without "port in use". */
      port: 5173,
      strictPort: false,
      proxy: {
        '/api/auth': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/auth/, '/auth'),
        },
        '/api/analytics': {
          target: 'http://127.0.0.1:8005',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/analytics/, '/analytics'),
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
