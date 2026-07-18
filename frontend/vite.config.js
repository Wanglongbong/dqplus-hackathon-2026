import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// None of the backend services expose CORS; the dev/preview servers proxy /api/* instead.
// The browser only talks to the public gateway. Extraction and matching stay internal.
const proxy = {
  '/api/backend': {
    target: process.env.GATEWAY_URL || 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/backend/, ''),
  },
  '/api': {
    target: process.env.GATEWAY_URL || 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy, allowedHosts: ['dqplus.ddns.net'] },
  preview: { port: 5173, proxy, allowedHosts: ['dqplus.ddns.net'] },
});
