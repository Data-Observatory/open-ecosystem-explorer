import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/graph/**', 'src/lib/invariants/**'],
      thresholds: {
        'src/lib/graph/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/lib/invariants/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
