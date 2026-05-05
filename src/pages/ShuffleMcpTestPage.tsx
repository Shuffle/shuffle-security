import { useState } from 'react';
import { Box, Typography, Container, Button, Stack, Paper } from '@mui/material';
import { ShuffleMCP, AppSearchDrawer, AppDetailDrawer } from '@/Shuffle-MCPs';

/**
 * Demo page for the Shuffle-MCPs library.
 * Shows all THREE library components used self-contained:
 *  1. <ShuffleMCP />        — search system
 *  2. <AppSearchDrawer />   — "Add Ingestion Source" drawer
 *  3. <AppDetailDrawer />   — App configuration sidebar (auth + MCP)
 *
 * This page imports ONLY from `@/Shuffle-MCPs` — no other host-app code.
 */
const ShuffleMcpTestPage = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<string | null>(null);

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Shuffle MCP — library demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Three self-contained components from <code>@/Shuffle-MCPs</code>. No
          host-app dependencies.
        </Typography>
      </Box>

      <Stack spacing={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>1. Inline search</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <code>&lt;ShuffleMCP /&gt;</code> — Algolia + private apps merged.
          </Typography>
          <ShuffleMCP inline layout="grid" gridColumns={3} />
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>2. Search drawer</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <code>&lt;AppSearchDrawer /&gt;</code> — exact same drawer used on
            /incidents → "Add Ingestion Source".
          </Typography>
          <Button variant="contained" onClick={() => setSearchOpen(true)}>
            Open search drawer
          </Button>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>3. App detail / config drawer</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <code>&lt;AppDetailDrawer /&gt;</code> — auth + MCP "try it out" for a single app.
          </Typography>
          <Stack direction="row" spacing={1}>
            {['Gmail', 'Slack', 'VirusTotal'].map(name => (
              <Button key={name} variant="outlined" onClick={() => setDetailApp(name)}>
                {name}
              </Button>
            ))}
          </Stack>
        </Paper>
      </Stack>

      <AppSearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Add Ingestion Source"
        subtitle="Search and authenticate a tool to ingest incidents from"
      />

      <AppDetailDrawer
        open={detailApp !== null}
        onClose={() => setDetailApp(null)}
        appName={detailApp}
      />
    </Container>
  );
};

export default ShuffleMcpTestPage;
