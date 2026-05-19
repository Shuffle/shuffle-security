import { defineConfig } from 'tsup';
import path from 'node:path';

/**
 * Build config for publishing @shuffleio/shuffle-core to npm.
 *
 * Mirrors the Shuffle-MCPs config: host-provided UI peers are marked external,
 * while markdown utilities are bundled to avoid downstream webpack ESM and
 * source-map-loader issues in consuming apps.
 */
export default defineConfig({
  entry: ['index.tsx'],
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  dts: {
    resolve: true,
    tsconfig: 'tsconfig.build.json',
  },
  sourcemap: false,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    // Host-app provided peers — never bundle. Use explicit strings (not a
    // regex) so esbuild keeps them as bare specifiers that the consumer's
    // bundler resolves via @mui's `exports` map. A `/^@mui\//` regex caused
    // some emitted ESM imports to be rewritten in a way that tripped
    // webpack 5's strict-ESM fullySpecified check on `@mui/material/styles`.
    '@mui/material',
    '@mui/material/styles',
    '@mui/system',
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
    /^@tanstack\//,
    'tailwind-merge',
    'clsx',
    'recharts',
    'date-fns',
    /^date-fns\//,
    'framer-motion',
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
