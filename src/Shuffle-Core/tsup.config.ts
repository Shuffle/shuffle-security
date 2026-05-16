import { defineConfig } from 'tsup';
import path from 'node:path';

/**
 * Build config for publishing @shuffleio/shuffle-core to npm.
 *
 * Mirrors the Shuffle-MCPs config: all UI / runtime peers are marked external,
 * and the Vite-style `@/Shuffle-Core/*` and `@/assets/*` path aliases are
 * mapped to relative paths so esbuild can resolve them.
 */
export default defineConfig({
  entry: ['index.tsx'],
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
    /^@mui\//,
    /^@emotion\//,
    'lucide-react',
    'react-router-dom',
    'react-router',
    'react-ga4',
    'react-device-detect',
    'mui-chips-input',
    'react-toastify',
    'dayjs',
    /^dayjs\//,
    /^@shuffleio\//,
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
      '@/Shuffle-Core': path.resolve(__dirname, '.'),
      '@/assets': path.resolve(__dirname, '../assets'),
    };
  },
});
