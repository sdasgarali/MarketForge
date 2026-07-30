import { copyFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  // migrate.ts / seed.ts are executed via tsx (not bundled), but include them
  // so a `dist` build can also run them; index.ts is the library entry.
  entry: ['src/index.ts', 'src/migrate.ts', 'src/seed.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  // migrate.ts reads rls.sql relative to its own dir → ship it alongside dist.
  async onSuccess() {
    await copyFile('src/rls.sql', 'dist/rls.sql');
  },
});
