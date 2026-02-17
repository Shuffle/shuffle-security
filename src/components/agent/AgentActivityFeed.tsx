/**
 * Agent Activity Feed - shows individual execution cards with expandable results
 */

import { useState } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { Typography } from '@mui/material';
import { AgentRun } from '@/services/agentActivity';
import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';
import AgentRunHeader from '@/components/agent/AgentRunHeader';

interface AgentActivityFeedProps {
  runs: AgentRun[];
  onRunClick?: (run: AgentRun) => void;
}

const AgentActivityFeed = ({ runs, onRunClick }: AgentActivityFeedProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Activity size={40} style={{ color: 'hsl(var(--muted-foreground))', marginBottom: 12 }} />
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
          No agent activity found
        </Typography>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 0.5, opacity: 0.7 }}>
          The agent hasn't performed any actions yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {runs.map((run, idx) => {
        const isExpanded = expandedId === run.execution_id;

        return (
          <motion.div
            key={run.execution_id || idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
          >
            <Box sx={{
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--card))',
              overflow: 'hidden',
              transition: 'border-color 0.15s ease',
              ...(isExpanded && {
                borderColor: 'hsl(var(--muted-foreground) / 0.3)',
              }),
            }}>
              <AgentRunHeader
                run={run}
                onClick={() => onRunClick ? onRunClick(run) : setExpandedId(isExpanded ? null : run.execution_id)}
                showChevron={!onRunClick}
                isExpanded={isExpanded}
              />

              {/* Expandable result viewer */}
              {!onRunClick && (
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <Box sx={{ borderTop: '1px solid hsl(var(--border))' }}>
                        <AgentRunResultViewer run={run} />
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default AgentActivityFeed;
