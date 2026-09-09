import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@rat/shared': resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
  // allowedHosts: true permite servir a través de un túnel (*.trycloudflare.com)
  server: { port: 5173, allowedHosts: true },
  preview: { port: 4173, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: true },
});
