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
 *  - Host-provided UI deps (MUI, framer-motion, sonner, lucide-react,
 *    react-router-dom, etc.) are declared `external` so they are NOT bundled.
 *  - Markdown / JSON viewer utilities are bundled to avoid downstream webpack
 *    ESM resolution and source-map-loader issues in consuming apps.
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
  sourcemap: false,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    // Host-app provided peers — never bundle.
    // List deep MUI/emotion subpaths explicitly (as plain strings, not regex)
    // so esbuild emits bare specifiers that webpack 5's `fullySpecified`
    // check in consuming apps accepts without extension.
    '@mui/material',
    '@mui/material/styles',
    '@mui/material/utils',
    '@mui/system',
    '@mui/system/RtlProvider',
    '@mui/system/createTheme',
    '@mui/system/styled',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@emotion/cache',
    'framer-motion',
    'sonner',
    'lucide-react',
    'react-router-dom',
    'react-router',
  ],
  // Also pass noExternal=false equivalent via esbuild to ensure
  // these are truly skipped even when tsup regex handling varies:
  esbuildPlugins: [],
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
