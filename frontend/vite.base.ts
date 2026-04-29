import path from 'path';

// Shared Vite config applied to all portal configs.
// Fixes monorepo node_modules resolution when `root` is a subdirectory.
export const sharedConfig = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Explicitly point to root node_modules so Vite finds hoisted packages
      'socket.io-client': path.resolve(__dirname, '../node_modules/socket.io-client'),
      'engine.io-client': path.resolve(__dirname, '../node_modules/engine.io-client'),
    },
  },
  optimizeDeps: {
    include: ['socket.io-client'],
  },
};
