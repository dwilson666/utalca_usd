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
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
