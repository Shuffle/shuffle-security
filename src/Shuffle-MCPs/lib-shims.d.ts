// Lib-build-only ambient module shims. NOT included by the host app's
// tsconfig (see tsconfig.app.json `exclude`). These let `tsup --dts` emit
// declarations in environments where peer/external packages aren't installed.
declare module 'react-router-dom';
declare module 'react-router';
declare module 'react-markdown';
declare module 'remark-gfm';
declare module 'remark-breaks';
declare module 'react18-json-view';
declare module 'react18-json-view/*';
declare module 'framer-motion';
declare module 'sonner';
declare module 'lucide-react';
declare module '*.css';
