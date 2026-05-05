---
name: Ask-agent context block
description: @AIAgent comments from /incidents/:id auto-attach a YAML context block (incident summary, observables w/ IOC flags, enrichments, correlations, stakeholders, recent timeline, top merge candidates) built by src/utils/agentContextBlock.ts
type: feature
---
When sending a question via the "Ask the AI agent" popover on the Incident detail page, the comment text is augmented with a fenced YAML context block before being saved to the timeline. Built in `src/utils/agentContextBlock.ts`, sourced from `editedObservables`, `enrichments`, `iocObservableKeys`, `visibleCorrelations`, `editedStakeholders`, `activity`, and `mergeCandidates.candidates` (top 8 by score). This gives the agent cross-incident reasoning material without re-deriving from raw OCSF.

Caps: 25 observables, 15 correlations, 10 stakeholders, 8 timeline events, 8 merge candidates.
