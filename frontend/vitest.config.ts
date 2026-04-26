import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    // Disable PostCSS processing in tests to avoid missing peer dependency errors
    postcss: { plugins: [] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@portals': path.resolve(__dirname, './src/portals'),
      // Stub chart.js and react-chartjs-2 since they're not installed in node_modules
      'chart.js': path.resolve(__dirname, './src/__mocks__/chart.js.ts'),
      'react-chartjs-2': path.resolve(__dirname, './src/__mocks__/react-chartjs-2.tsx'),
      // Stub use-sync-external-store (peer dep of @tanstack/react-query not installed)
      // More specific paths must come before the general one
      'use-sync-external-store/shim/index.js': path.resolve(__dirname, './src/__mocks__/use-sync-external-store/shim/index.js'),
      'use-sync-external-store/shim': path.resolve(__dirname, './src/__mocks__/use-sync-external-store/shim/index.js'),
      'use-sync-external-store': path.resolve(__dirname, './src/__mocks__/use-sync-external-store/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    deps: {
      inline: ['@tanstack/react-query', '@tanstack/query-core'],
    },
  },
});
