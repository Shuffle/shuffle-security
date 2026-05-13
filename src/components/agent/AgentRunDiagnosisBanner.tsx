/**
 * Back-compat re-export. The real component now lives in the Shuffle-MCPs
 * library so every surface (AgentUI, drawers, incident pages, ...) uses the
 * exact same diagnosis banner.
 */
export { AgentRunDiagnosisBanner as default } from '@/Shuffle-MCPs';
