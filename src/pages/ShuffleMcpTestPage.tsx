import { useState, useEffect, type ReactNode } from 'react';
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
import {
  ShuffleMCP,
  AppSearchDrawer,
  AppDetailDrawer,
  AppAuthSection,
  TryMcpSection,
  SingulActionsPreview,
  useAppLookup,
} from '@/Shuffle-MCPs';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { API_CONFIG } from '@/Shuffle-MCPs/api';
import { Box as MuiBox, TextField, Skeleton } from '@mui/material';

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

const SNIPPET_AUTH_SECTION = `import { useState } from 'react';
import { AppAuthSection, useAppLookup } from '@shuffleio/shuffle-mcps';
import { usePageMeta } from '@/hooks/usePageMeta';

// Pass any app name — the hook resolves icon, id, categories, auth entries.
const lookup = useAppLookup('Gmail');
const [open, setOpen] = useState(true);

<AppAuthSection
  displayName={lookup.displayName}
  algoliaApp={lookup.algoliaApp}
  resolvedAlgoliaId={lookup.algoliaId}
  authState={lookup.authState}
  expanded={open}
  onToggle={() => setOpen(v => !v)}
  authCount={lookup.authCount}
  matchingEntries={lookup.matchingEntries}
  onAuthChange={lookup.handleAuthChange}
  onTestConnection={lookup.handleTestConnection}
  onSaveAuth={lookup.handleSaveAuth}
  onRefreshAuth={lookup.refreshAuth}
/>`;

const SNIPPET_TRY_MCP = `import { TryMcpSection, useAppLookup } from '@shuffleio/shuffle-mcps';

const lookup = useAppLookup('Slack');

<TryMcpSection
  appName="Slack"
  appIcon={lookup.image}
  appId={lookup.algoliaId || 'Slack'}
  categories={lookup.categories}
/>`;

const SNIPPET_TRY_ACTIONS = `import { SingulActionsPreview, useAppLookup } from '@shuffleio/shuffle-mcps';

const lookup = useAppLookup('VirusTotal');

// All actions across the default categories, sorted so the app's
// matching category appears first and is auto-selected.
<SingulActionsPreview
  appName="VirusTotal"
  categories={lookup.categories}
/>`;

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

/** Tiny shared input + lookup wrapper used by the three section demos below. */
function AppNamePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <MuiBox sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">App name:</Typography>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Gmail, Slack, VirusTotal"
        sx={{ width: 240 }}
      />
    </MuiBox>
  );
}

function AuthSectionDemo({ appName }: { appName: string }) {
  const lookup = useAppLookup(appName);
  const [open, setOpen] = useState(true);
  if (lookup.loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />;
  return (
    <AppAuthSection
      displayName={lookup.displayName}
      algoliaApp={lookup.algoliaApp}
      resolvedAlgoliaId={lookup.algoliaId}
      authState={lookup.authState}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      authCount={lookup.authCount}
      matchingEntries={lookup.matchingEntries}
      onAuthChange={lookup.handleAuthChange}
      onTestConnection={lookup.handleTestConnection}
      onSaveAuth={lookup.handleSaveAuth}
      onRefreshAuth={lookup.refreshAuth}
    />
  );
}

function TryMcpDemo({ appName }: { appName: string }) {
  const lookup = useAppLookup(appName);
  if (lookup.loading) return <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />;
  return (
    <TryMcpSection
      appName={appName}
      appIcon={lookup.image}
      appId={lookup.algoliaId || appName}
      categories={lookup.categories}
    />
  );
}

function TryActionsDemo({ appName }: { appName: string }) {
  const lookup = useAppLookup(appName);
  if (lookup.loading) return <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />;
  return <SingulActionsPreview appName={appName} categories={lookup.categories} />;
}

const ShuffleMcpTestPage = () => {

  usePageMeta({
    title: 'Shuffle MCP Demo',
    description: 'Try the Shuffle MCP demo. Search 3,000+ security app integrations and run live MCP actions in your browser.',
    url: '/shuffle-mcp-demo',
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<string | null>(null);
  const [authApp, setAuthApp] = useState('Gmail');
  const [mcpApp, setMcpApp] = useState('Slack');
  const [actionsApp, setActionsApp] = useState('VirusTotal');

  useEffect(() => {
    const TITLE = 'Shuffle MCP — React component library demo';
    const DESCRIPTION =
      'Live demo of @shuffleio/shuffle-mcps: six drop-in React components for app search, authentication, and MCP integration powered by Shuffle.';
    const URL = 'https://security.shuffler.io/shuffle-mcp-demo';
    const IMAGE = 'https://security.shuffler.io/og-image.png';

    const prevTitle = document.title;
    document.title = TITLE;

    const setMeta = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      const created = !el;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      const prev = el.getAttribute(attr);
      el.setAttribute(attr, value);
      return () => {
        if (created) el?.remove();
        else if (prev !== null) el?.setAttribute(attr, prev);
      };
    };

    const cleanups = [
      setMeta('meta[name="description"]', 'content', DESCRIPTION, () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        return m;
      }),
      setMeta('link[rel="canonical"]', 'href', URL, () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      }),
      setMeta('meta[property="og:title"]', 'content', TITLE, () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:title');
        return m;
      }),
      setMeta('meta[property="og:description"]', 'content', DESCRIPTION, () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:description');
        return m;
      }),
      setMeta('meta[property="og:type"]', 'content', 'website', () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:type');
        return m;
      }),
      setMeta('meta[property="og:url"]', 'content', URL, () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:url');
        return m;
      }),
      setMeta('meta[property="og:image"]', 'content', IMAGE, () => {
        const m = document.createElement('meta');
        m.setAttribute('property', 'og:image');
        return m;
      }),
      setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image', () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'twitter:card');
        return m;
      }),
      setMeta('meta[name="twitter:title"]', 'content', TITLE, () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'twitter:title');
        return m;
      }),
      setMeta('meta[name="twitter:description"]', 'content', DESCRIPTION, () => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'twitter:description');
        return m;
      }),
    ];

    return () => {
      document.title = prevTitle;
      cleanups.forEach(fn => fn());
    };
  }, []);

  return (
    <>
      <LandingNavbar />
      <Container maxWidth="lg" sx={{ pt: { xs: 12, md: 16 }, pb: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Shuffle MCP — library demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Six self-contained components from{' '}
          <Box
            component="a"
            href="https://www.npmjs.com/package/@shuffleio/shuffle-mcps"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'hsl(var(--primary))', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            <code>@shuffleio/shuffle-mcps</code>
          </Box>
          . Expand "Show source" under each section to see the exact code that produced it.
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

        <DemoSection
          title="4. Authentication (standalone)"
          description={<><code>&lt;AppAuthSection /&gt;</code> + <code>useAppLookup()</code> — drop the auth card anywhere by passing just an app name.</>}
          code={SNIPPET_AUTH_SECTION}
        >
          <AppNamePicker value={authApp} onChange={setAuthApp} />
          <AuthSectionDemo appName={authApp} />
        </DemoSection>

        <DemoSection
          title="5. Try MCP (standalone)"
          description={<><code>&lt;TryMcpSection /&gt;</code> — chat against an app's MCP tools. Resolves icon + id from the app name.</>}
          code={SNIPPET_TRY_MCP}
        >
          <AppNamePicker value={mcpApp} onChange={setMcpApp} />
          <TryMcpDemo appName={mcpApp} />
        </DemoSection>

        <DemoSection
          title="6. Try individual actions (standalone)"
          description={<><code>&lt;SingulActionsPreview /&gt;</code> — full curl/python catalog with Play. Sorts the app's category to the top.</>}
          code={SNIPPET_TRY_ACTIONS}
        >
          <AppNamePicker value={actionsApp} onChange={setActionsApp} />
          <TryActionsDemo appName={actionsApp} />
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
    </>
  );
};

export default ShuffleMcpTestPage;
