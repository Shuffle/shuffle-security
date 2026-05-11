declare module '*.png' { const src: string; export default src; }
declare module '*.jpg' { const src: string; export default src; }
declare module '*.jpeg' { const src: string; export default src; }
declare module '*.svg' { const src: string; export default src; }
declare module '*.gif' { const src: string; export default src; }
declare module '*.webp' { const src: string; export default src; }
declare module '*.css';

// Ambient shims for peer/external packages so the standalone dts build does
// not fail in environments where these aren't installed. The host app and
// real consumers still get the proper types from the actual packages.
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
