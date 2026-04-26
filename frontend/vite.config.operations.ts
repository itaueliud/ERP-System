import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { sharedConfig } from './vite.base';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/portals/operations'),
  publicDir: path.resolve(__dirname, 'public'),
  server: {
    port: 5176,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  ...sharedConfig,
  build: {
    outDir: path.resolve(__dirname, 'dist/operations'),
    emptyOutDir: true,
  },
});
