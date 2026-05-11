/**
 * AgentsPage — standalone full-view of the Shuffle-MCPs AgentUI component.
 *
 * Mirrors the legacy /agents page from Shuffle Core: a single, full-width
 * surface for starting and debugging agent runs. Resumes from
 * `?execution_id=...&authorization=...` URL params.
 */

import { Box } from '@mui/material';
import { AgentUI } from '@/Shuffle-MCPs';

const AgentsPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', width: '100%', px: { xs: 2, md: 4 }, pt: '10vh', pb: 3 }}>
      <AgentUI maxWidth={820} />
    </Box>
  );
};

export default AgentsPage;
