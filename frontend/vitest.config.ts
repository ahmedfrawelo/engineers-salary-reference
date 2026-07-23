import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@features': path.resolve(__dirname, 'src/app/features'),
      '@shared-kernel': path.resolve(__dirname, 'src/app/shared-kernel'),
      '@platform': path.resolve(__dirname, 'src/app/platform'),
      '@infrastructure': path.resolve(__dirname, 'src/app/infrastructure'),
      '@shared': path.resolve(__dirname, 'src/app/shared'),
      '@core': path.resolve(__dirname, 'src/app/core'),
      '@auth': path.resolve(__dirname, 'src/app/auth'),
      '@env': path.resolve(__dirname, 'src/environments'),
      '@testing': path.resolve(__dirname, 'src/testing'),
      '@hugeicons/angular': path.resolve(
        __dirname,
        'node_modules/@hugeicons/angular/dist/fesm2022/hugeicons-angular.mjs'
      ),
      '@hugeicons/core-free-icons': path.resolve(
        __dirname,
        'node_modules/@hugeicons/core-free-icons/dist/esm/index.js'
      )
    }
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
    entries: ['src/**/*.spec.ts']
  },
  server: {
    watch: {
      ignored: ['**/dist/**', '**/dist-*/*/**', '**/playwright-report/**']
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    pool: 'vmThreads',
    fileParallelism: false,
    maxConcurrency: 1,
    maxWorkers: 1
  }
});
