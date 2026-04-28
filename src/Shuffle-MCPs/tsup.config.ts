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
  // Use the library-local tsconfig for both transpile and dts. Without this,
  // tsup walks up and picks the host app's root tsconfig, which has no `jsx`
  // setting and breaks the .d.ts generation for ShuffleMCP.tsx.
  tsconfig: 'tsconfig.build.json',
  dts: {
    resolve: true,
    tsconfig: 'tsconfig.build.json',
  },
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  loader: {
    '.css': 'copy',
  },
  injectStyle: false,
});
