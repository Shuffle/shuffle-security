import { useState } from 'react';
import { Box, Typography, Container, Button } from '@mui/material';
import { AppSearchDrawer } from '@/Shuffle-MCPs';

/**
 * Demo page for the shuffle-mcps library — uses the EXACT same
 * "Add Ingestion Source" drawer used on /incidents.
 */
const ShuffleMcpTestPage = () => {
  const [open, setOpen] = useState(true);

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Shuffle MCP — default demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Renders the exact <code>&lt;AppSearchDrawer /&gt;</code> used on{' '}
          <code>/incidents → Add Ingestion Source</code>.
        </Typography>
      </Box>

      <Button variant="contained" onClick={() => setOpen(true)}>
        Open Add Ingestion Source
      </Button>

      <AppSearchDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Add Ingestion Source"
        subtitle="Search and authenticate a tool to ingest incidents from"
      />
    </Container>
  );
};

export default ShuffleMcpTestPage;
