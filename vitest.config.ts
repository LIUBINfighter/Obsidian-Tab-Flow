import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        'main.js',
        'assets/',
        'scripts/',
        'docs/',
        'esbuild.config.mjs',
        'version-bump.mjs'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'obsidian': path.resolve(__dirname, 'tests/mocks/obsidian.ts')
    }
  }
});
