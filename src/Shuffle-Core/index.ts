/**
 * Shuffle-Core — standalone React surfaces extracted from the Shuffle
 * Security host app. Mirrors the structure of `@/Shuffle-MCPs` so each piece
 * (Usecases page, future form-control page, etc.) can be consumed in isolation
 * and eventually published as `@shuffleio/shuffle-core`.
 *
 * No bundled side-effect CSS yet — see `shuffle-core.css` if you want the
 * shadcn-style token fallbacks when embedding outside the host app.
 */

import './shuffle-core.css';

export { default as Usecases } from './Usecases';
export { default } from './Usecases';
export { default as UsecaseAlluvialDiagram } from './UsecaseAlluvialDiagram';
export { usePageMeta } from './usePageMeta';
export { toast, setToastImpl } from './toast';
