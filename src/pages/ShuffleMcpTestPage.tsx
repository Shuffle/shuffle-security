import { useState, type ReactNode } from 'react';
import {
  Box,
  Typography,
  Container,
  Button,
  Stack,
  Paper,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { ShuffleMCP, AppSearchDrawer, AppDetailDrawer } from '@/Shuffle-MCPs';
import { API_CONFIG } from '@/Shuffle-MCPs/api';

/**
 * Demo page for the Shuffle-MCPs library.
 * Each section is paired with an MUI-docs-style expandable code block
 * showing the exact source that produced the rendered demo.
 */

const SNIPPET_INLINE_SEARCH = `import { ShuffleMCP } from '@shuffleio/shuffle-mcps';

<ShuffleMCP inline layout="grid" gridColumns={3} />`;

const SNIPPET_SEARCH_DRAWER = `import { useState } from 'react';
import { Button } from '@mui/material';
import { AppSearchDrawer } from '@shuffleio/shuffle-mcps';

const [open, setOpen] = useState(false);

<>
  <Button variant="contained" onClick={() => setOpen(true)}>
    Open search drawer
  </Button>

  <AppSearchDrawer
    open={open}
    onClose={() => setOpen(false)}
    title="Add Ingestion Source"
    subtitle="Search and authenticate a tool to ingest incidents from"
  />
</>`;

const SNIPPET_DETAIL_DRAWER = `import { useState } from 'react';
import { Button, Stack } from '@mui/material';
import { AppDetailDrawer } from '@shuffleio/shuffle-mcps';

const [appName, setAppName] = useState<string | null>(null);

<>
  <Stack direction="row" spacing={1}>
    {['Gmail', 'Slack', 'VirusTotal'].map(name => (
      <Button key={name} variant="outlined" onClick={() => setAppName(name)}>
        {name}
      </Button>
    ))}
  </Stack>

  <AppDetailDrawer
    open={appName !== null}
    onClose={() => setAppName(null)}
    appName={appName}
  />
</>`;

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Box
      sx={{
        position: 'relative',
        mt: 2,
        borderRadius: 1.5,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--muted) / 0.4)',
      }}
    >
      <Tooltip title={copied ? 'Copied' : 'Copy'} placement="left">
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
          }}
        >
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          pr: 5,
          overflowX: 'auto',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: '0.78rem',
          lineHeight: 1.55,
          color: 'hsl(var(--foreground))',
          whiteSpace: 'pre',
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  );
}

function DemoSection({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description: ReactNode;
  code: string;
  children: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      <Box sx={{ mb: 1 }}>{children}</Box>

      <Box
        sx={{
          mt: 2,
          pt: 1.5,
          borderTop: '1px solid hsl(var(--border))',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          size="small"
          onClick={() => setShowCode(v => !v)}
          endIcon={
            <ExpandMoreIcon
              sx={{
                transition: 'transform 0.2s',
                transform: showCode ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          }
          sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
        >
          {showCode ? 'Hide source' : 'Show source'}
        </Button>
      </Box>

      <Collapse in={showCode} unmountOnExit>
        <CodeBlock code={code} />
      </Collapse>
    </Paper>
  );
}

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
          Three self-contained components from <code>@/Shuffle-MCPs</code>. Expand
          "Show source" under each section to see the exact code that produced it.
        </Typography>
      </Box>

      <Stack spacing={4}>
        <DemoSection
          title="1. Inline search"
          description={<><code>&lt;ShuffleMCP /&gt;</code> — Algolia + private apps merged into one searchable list.</>}
          code={SNIPPET_INLINE_SEARCH}
        >
          <ShuffleMCP inline layout="grid" gridColumns={3} apiKey={API_CONFIG.apiKey || undefined} />
        </DemoSection>

        <DemoSection
          title="2. Search drawer"
          description={<><code>&lt;AppSearchDrawer /&gt;</code> — the exact same drawer used on /incidents → "Add Ingestion Source".</>}
          code={SNIPPET_SEARCH_DRAWER}
        >
          <Button variant="contained" onClick={() => setSearchOpen(true)}>
            Open search drawer
          </Button>
        </DemoSection>

        <DemoSection
          title="3. App detail / config drawer"
          description={<><code>&lt;AppDetailDrawer /&gt;</code> — auth + MCP "try it out" for a single app.</>}
          code={SNIPPET_DETAIL_DRAWER}
        >
          <Stack direction="row" spacing={1}>
            {['Gmail', 'Slack', 'VirusTotal'].map(name => (
              <Button key={name} variant="outlined" onClick={() => setDetailApp(name)}>
                {name}
              </Button>
            ))}
          </Stack>
        </DemoSection>
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
