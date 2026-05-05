import { defineConfig } from 'tsup';
import path from 'node:path';

/**
 * Build config for publishing @shuffleio/shuffle-mcps to npm.
 *
 * This is only used by CI when packaging the library — it is NOT used by the
 * host app's Vite build. The host app keeps importing source directly via the
 * `@/Shuffle-MCPs` path alias.
 *
 * Notes:
 *  - All UI / runtime deps used by the library (MUI, framer-motion, sonner,
 *    lucide-react, react-router-dom, etc.) are declared `external` so they
 *    are NOT bundled. Consumers install them via peerDependencies.
 *  - The library source uses `@/Shuffle-MCPs/*` and `@/assets/*` path
 *    aliases (Vite-style) which esbuild cannot resolve on its own. We map
 *    them here to relative paths inside the library directory.
 */
export default defineConfig({
  entry: ['index.ts'],
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  dts: {
    resolve: true,
    tsconfig: 'tsconfig.build.json',
  },
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    // Host-app provided peers — never bundle:
    /^@mui\//,
    /^@emotion\//,
    'framer-motion',
    'sonner',
    'lucide-react',
    'react-router-dom',
    'react-router',
  ],
  loader: {
    '.css': 'copy',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.svg': 'dataurl',
  },
  injectStyle: false,
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias || {}),
      '@/Shuffle-MCPs': path.resolve(__dirname, '.'),
      '@/assets': path.resolve(__dirname, '../assets'),
    };
  },
});
