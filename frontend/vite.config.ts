import { defineConfig } from 'vite';

const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/ws': {
        target: backendTarget,
        ws: true,
        changeOrigin: true
      },
    }
  }
});