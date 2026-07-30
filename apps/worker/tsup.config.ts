import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  // Workspace packages are published as ESM and resolvable at runtime; keep them
  // external so the worker image installs them rather than inlining.
  external: [
    '@marketforge/config',
    '@marketforge/logger',
    '@marketforge/contracts',
    '@marketforge/db',
    '@marketforge/queue',
    '@marketforge/adapters',
    'bullmq',
    'ioredis',
    'drizzle-orm',
    'undici',
  ],
});
