/**
 * TryMcpSection — Standalone "Try MCP" block.
 *
 * Wraps the heading + AppMcpChat. Pass in the resolved app props.
 */

import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import AppMcpChat from '@/Shuffle-MCPs/AppMcpChat';

export interface TryMcpSectionProps {
  appName: string;
  /** Image URL used as the chat avatar. */
  appIcon?: string;
  /** Resolved app id (Algolia objectID or Shuffle id). */
  appId: string;
  /** App categories — used to pick suggested actions. */
  categories?: string[];
}

export default function TryMcpSection({ appName, appIcon, appId, categories }: TryMcpSectionProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '0.95rem', mb: 1.5 }}>
          Try MCP
        </Typography>
        <AppMcpChat
          appName={appName}
          appIcon={appIcon}
          appId={appId}
          categories={categories}
        />
      </Box>
    </motion.div>
  );
}
