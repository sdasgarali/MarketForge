import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Minimal valid env so `@marketforge/config` (eagerly loaded via the logger)
    // validates during unit tests. These are throwaway TEST-scoped values.
    env: {
      APP_ENV: 'TEST',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      ENCRYPTION_MASTER_KEY: 'dGVzdC10ZXN0LXRlc3QtdGVzdC10ZXN0LXRlc3QtMTI=',
      API_KEY_HASH_PEPPER: 'test-pepper',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
