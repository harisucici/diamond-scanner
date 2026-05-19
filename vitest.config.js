import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'dist', 'db'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'db/',
        'dist/',
        'tests/',
        '**/*.config.js',
        '**/server.js'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
