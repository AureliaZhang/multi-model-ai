import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Server is CommonJS; forks avoid ESM interop surprises with better-sqlite3 etc.
    pool: 'forks',
  },
});
