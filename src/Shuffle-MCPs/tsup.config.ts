import { defineConfig } from 'tsup';

/**
 * Build config for publishing @shuffle/singul.js to npm.
 *
 * This is only used by CI when packaging the library — it is NOT used by the
 * host app's Vite build. The host app keeps importing source directly via the
 * `@/Shuffle-MCPs` path alias.
 */
export default defineConfig({
  entry: ['index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  loader: {
    '.css': 'copy',
  },
  injectStyle: false,
});
