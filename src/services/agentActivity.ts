/**
 * Project-side re-export of the standalone agent-activity service that now
 * lives inside the Shuffle-MCPs library. Existing hooks/components import
 * from `@/services/agentActivity`; keeping this file as a thin shim lets us
 * move the source-of-truth into the lib without churning every call site.
 */

export {
  searchAgentActivity,
} from '@/Shuffle-MCPs/agentActivity';

export type {
  AgentRun,
  AgentRunResult,
  AgentDecision,
  AgentActivityResponse,
  AgentActivityParams,
} from '@/Shuffle-MCPs/agentActivity';
