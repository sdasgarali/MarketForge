import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  // Workspace packages are resolved at runtime from node_modules (pnpm symlinks);
  // keep them external so we don't bundle their source.
  external: [/^@marketforge\//],
});
