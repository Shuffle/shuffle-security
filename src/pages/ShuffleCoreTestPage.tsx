import { ChevronDown as ExpandMoreIcon, Copy as ContentCopyIcon, Check as CheckIcon, Github as GitHubIcon } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
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
import {
  Usecases,
  UsecaseAlluvialDiagram,
  FormInput,
  RecentWorkflow,
  OnboardingFlow,
  ProductChoiceStep,
} from '@shuffleio/shuffle-core';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

/**
 * Demo page for the Shuffle-Core library — mirrors /shuffle-mcp-demo.
 * Each section pairs the rendered surface with a "Show source" snippet
 * of the exact code that produced it.
 */

const SNIPPET_USECASES = `import { Usecases } from '@shuffleio/shuffle-core';
import '@shuffleio/shuffle-core/shuffle-core.css';

// Full Usecases explorer — card grid + detail view.
// Reads :flowId from useParams() and selected_object from useSearchParams().
<Usecases />`;

const SNIPPET_ALLUVIAL = `import { UsecaseAlluvialDiagram } from '@shuffleio/shuffle-core';

// Source tools → Shuffle → destination tools flow visualization.
<UsecaseAlluvialDiagram
  sourceCategory="siem"
  targetCategory="case_management"
/>`;

const SNIPPET_ONBOARDING = `import { OnboardingFlow } from '@shuffleio/shuffle-core';

// Sources → Authenticate → Automate, shared between Core and Security.
<OnboardingFlow
  product="security"
  coreRedirectUrl="https://shuffler.io/onboarding"
/>`;

const SNIPPET_PRODUCT_CHOICE = `import { ProductChoiceStep } from '@shuffleio/shuffle-core';

// Just the "Which Shuffle are you using?" picker step.
<ProductChoiceStep
  onSelect={(product) => console.log('picked', product)}
  coreRedirectUrl="https://shuffler.io/onboarding"
  securityRedirectUrl="https://security.shuffler.io/onboarding"
/>`;

const SNIPPET_FORM_INPUT = `import { FormInput } from '@shuffleio/shuffle-core';

// Public-facing form runner for a workflow's form_control.input_questions.
// Pass a workflow object (typically loaded from /api/v1/workflows/:id).
<FormInput workflow={workflow} />`;

const SNIPPET_RECENT_WORKFLOW = `import { RecentWorkflow } from '@shuffleio/shuffle-core';

// Card used in the sidebar / dashboards to surface a recent workflow.
<RecentWorkflow workflow={workflow} leftNavOpen />`;

const SNIPPET_EDIT_WORKFLOW = `import { useState } from 'react';
import { Button } from '@mui/material';
import { EditWorkflow } from '@shuffleio/shuffle-core';

const [open, setOpen] = useState(false);
const [workflow, setWorkflow] = useState({ name: '', description: '', tags: [] });

<>
  <Button variant="contained" onClick={() => setOpen(true)}>
    New workflow
  </Button>
  <EditWorkflow
    modalOpen={open}
    setModalOpen={setOpen}
    workflow={workflow}
    setWorkflow={setWorkflow}
    isEditing={false}
    saveWorkflow={(wf) => console.log('save', wf)}
  />
</>`;

// Lightweight syntax highlighter for the demo "Show source" snippets.
const SYNTAX_COLORS = {
  comment: 'hsl(var(--muted-foreground))',
  string: 'hsl(142 60% 55%)',
  keyword: 'hsl(280 70% 70%)',
  tag: 'hsl(var(--primary))',
  attr: 'hsl(40 90% 65%)',
  number: 'hsl(25 95% 65%)',
  punct: 'hsl(var(--muted-foreground))',
};

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue',
  'new', 'class', 'extends', 'this', 'await', 'async', 'true', 'false', 'null',
  'undefined', 'typeof', 'in', 'of', 'as', 'interface', 'type',
]);

function highlightCode(code: string): React.ReactNode[] {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][A-Za-z0-9_]*)|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)|([^\s\w]+)|(\s+)/g;
  const out: React.ReactNode[] = [];
  let m: RegExpExecArray | null;
  let key = 0;
  let prevWasTagOpen = false;
  while ((m = re.exec(code)) !== null) {
    const [, comment, str, tag, ident, num, punct, ws] = m;
    if (comment) {
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.comment, fontStyle: 'italic' }}>{comment}</span>);
    } else if (str) {
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.string }}>{str}</span>);
    } else if (tag) {
      prevWasTagOpen = true;
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.punct }}>{tag.startsWith('</') ? '</' : '<'}</span>);
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.tag }}>{tag.replace(/^<\/?/, '')}</span>);
    } else if (ident) {
      if (prevWasTagOpen) {
        out.push(<span key={key++} style={{ color: SYNTAX_COLORS.attr }}>{ident}</span>);
      } else if (KEYWORDS.has(ident)) {
        out.push(<span key={key++} style={{ color: SYNTAX_COLORS.keyword }}>{ident}</span>);
      } else {
        out.push(<span key={key++} style={{ color: 'hsl(var(--foreground))' }}>{ident}</span>);
      }
    } else if (num) {
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.number }}>{num}</span>);
    } else if (punct) {
      if (prevWasTagOpen && (punct === '>' || punct === '/>')) prevWasTagOpen = false;
      if (punct === '{' || punct === '}') prevWasTagOpen = false;
      out.push(<span key={key++} style={{ color: SYNTAX_COLORS.punct }}>{punct}</span>);
    } else if (ws) {
      out.push(ws);
    }
  }
  return out;
}

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
          {copied ? <CheckIcon size={20} /> : <ContentCopyIcon size={20} />}
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
        <code>{highlightCode(code)}</code>
      </Box>
    </Box>
  );
}

type ApiEndpoint = { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'ALGOLIA'; path: string; description?: string };

const METHOD_COLORS: Record<ApiEndpoint['method'], string> = {
  GET: 'hsl(142 60% 55%)',
  POST: 'hsl(40 90% 65%)',
  PUT: 'hsl(210 80% 65%)',
  DELETE: 'hsl(0 75% 65%)',
  ALGOLIA: 'hsl(280 70% 70%)',
};

function ApiPanel({ apis }: { apis: ApiEndpoint[] }) {
  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--muted) / 0.4)',
        p: 2,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <Stack spacing={1}>
        {apis.map((api, i) => (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box
                component="span"
                sx={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: METHOD_COLORS[api.method],
                  border: `1px solid ${METHOD_COLORS[api.method]}`,
                  borderRadius: 0.5,
                  px: 0.6,
                  py: 0.05,
                  flexShrink: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {api.method}
              </Box>
              <Box
                component="code"
                sx={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: '0.75rem',
                  color: 'hsl(var(--foreground))',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={api.path}
              >
                {api.path}
              </Box>
            </Box>
            {api.description && (
              <Typography
                variant="caption"
                sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', pl: 0.25 }}
              >
                {api.description}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
      <Box sx={{ flex: 1 }} />
      <Typography
        variant="caption"
        sx={{ mt: 1.5, color: 'hsl(var(--muted-foreground))', fontSize: '0.68rem' }}
      >
        Full reference:{' '}
        <Box
          component="a"
          href="https://shuffler.io/docs/API"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: 'hsl(var(--primary))', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          shuffler.io/docs/API
        </Box>
      </Typography>
    </Box>
  );
}

function DemoSection({
  title,
  description,
  code,
  apis,
  children,
}: {
  title: string;
  description: ReactNode;
  code: string;
  apis?: ApiEndpoint[];
  children?: ReactNode;
}) {
  const [showCode, setShowCode] = useState(false);
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: 'hsl(var(--card))',
        backgroundImage: 'none',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--card-foreground))',
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      {children && <Box sx={{ mb: 1 }}>{children}</Box>}

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
              style={{ transition: 'transform 0.2s', transform: showCode ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          }
          sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
        >
          {showCode ? 'Hide source' : 'Show source'}
        </Button>
      </Box>

      <Collapse in={showCode} unmountOnExit>
        {apis && apis.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.6fr) minmax(0, 1fr)' },
              alignItems: 'stretch',
            }}
          >
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="caption"
                sx={{
                  mt: 2,
                  mb: -1,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                Frontend (React)
              </Typography>
              <CodeBlock code={code} />
            </Box>
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="caption"
                sx={{
                  mt: 2,
                  mb: 1,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                Backend APIs called
              </Typography>
              <ApiPanel apis={apis} />
            </Box>
          </Box>
        ) : (
          <CodeBlock code={code} />
        )}
      </Collapse>
    </Paper>
  );
}

// Minimal sample workflow used to render <RecentWorkflow /> without a backend.
const SAMPLE_WORKFLOW = {
  id: 'demo-workflow-1',
  name: 'Phishing triage',
  description: 'Pull suspicious emails, enrich indicators with VirusTotal, and open a case if malicious.',
  tags: ['email', 'phishing', 'triage'],
  updated: Math.floor(Date.now() / 1000) - 3600,
  edited: Math.floor(Date.now() / 1000) - 3600,
  actions: new Array(7).fill(0).map((_, i) => ({ id: `a-${i}` })),
  triggers: [{ id: 't-0' }],
  image: '',
  form_control: { input_markdown: '' },
};

const ShuffleCoreTestPage = () => {
  // Default to dark mode for unauthenticated visitors on this public demo page.
  const { isAuthenticated, isLoading } = useAuth();
  const { setTheme } = useTheme();
  const forcedThemeRef = useRef(false);
  useEffect(() => {
    if (isLoading || forcedThemeRef.current) return;
    if (!isAuthenticated) {
      forcedThemeRef.current = true;
      setTheme('dark');
    }
  }, [isAuthenticated, isLoading, setTheme]);

  useEffect(() => {
    const TITLE = 'Shuffle Core — React component library demo';
    const DESCRIPTION =
      'Live demo of @shuffleio/shuffle-core: the Usecases explorer, alluvial flow diagram, onboarding flow, and workflow form components — drop-in React surfaces from the Shuffle Security app.';
    const URL = 'https://security.shuffler.io/shuffle-core-demo';
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
            Shuffle Core — library demo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Page-level React surfaces from{' '}
            <Box
              component="a"
              href="https://www.npmjs.com/package/@shuffleio/shuffle-core"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'hsl(var(--primary))', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              <code>@shuffleio/shuffle-core</code>
            </Box>
            . Expand "Show source" under each section to see the exact code that produced it.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Box
              component="a"
              href="https://github.com/shuffle/shuffle"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                color: 'hsl(var(--foreground))',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.15s',
                '&:hover': {
                  borderColor: 'hsl(var(--primary) / 0.5)',
                  backgroundColor: 'hsl(var(--primary) / 0.08)',
                },
              }}
            >
              <GitHubIcon size={16} />
              Shuffle Core
            </Box>
            <Box
              component="a"
              href="/shuffle-mcp-demo"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted) / 0.5)',
                color: 'hsl(var(--foreground))',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.15s',
                '&:hover': {
                  borderColor: 'hsl(var(--primary) / 0.5)',
                  backgroundColor: 'hsl(var(--primary) / 0.08)',
                },
              }}
            >
              See the Shuffle MCPs demo →
            </Box>
          </Stack>
        </Box>

        <Stack spacing={4}>
          <DemoSection
            title="1. Usecases explorer"
            description={<><code>&lt;Usecases /&gt;</code> — the full Usecases page (card grid plus the per-usecase detail view). Reads <code>:flowId</code> from <code>useParams()</code> and <code>selected_object</code> from <code>useSearchParams()</code>.</>}
            code={SNIPPET_USECASES}
            apis={[
              { method: 'GET', path: '/api/v1/workflows/usecases', description: 'Usecase catalog grouped by category' },
              { method: 'GET', path: '/api/v1/apps/authentication', description: 'Marks which usecase tools are connected' },
              { method: 'GET', path: '/api/v1/workflows', description: 'User workflows mapped to usecases' },
            ]}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, overflow: 'hidden', maxHeight: 720, overflowY: 'auto' }}>
              <Usecases />
            </Box>
          </DemoSection>

          <DemoSection
            title="2. Usecase alluvial diagram"
            description={<><code>&lt;UsecaseAlluvialDiagram /&gt;</code> — source tools → Shuffle → destination tools flow visualization for a usecase. Detects installed apps that match the source/target categories.</>}
            code={SNIPPET_ALLUVIAL}
            apis={[
              { method: 'ALGOLIA', path: 'appsearch index', description: 'Catalog lookup for source/target apps' },
              { method: 'GET', path: '/api/v1/apps', description: 'User-private apps merged into the diagram (when logged in)' },
              { method: 'GET', path: '/api/v1/apps/authentication', description: 'Highlights authenticated tools' },
            ]}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, p: 2, backgroundColor: 'hsl(var(--muted) / 0.2)' }}>
              <UsecaseAlluvialDiagram sourceCategory="siem" targetCategory="case_management" />
            </Box>
          </DemoSection>

          <DemoSection
            title="3. Onboarding flow"
            description={<><code>&lt;OnboardingFlow /&gt;</code> — the shared Sources → Authenticate → Automate experience. <code>product</code>, <code>coreRedirectUrl</code>, and <code>showProductChoice</code> let host apps customize the entry point.</>}
            code={SNIPPET_ONBOARDING}
            apis={[
              { method: 'GET', path: '/api/v1/apps/authentication', description: 'Resolve already-connected sources' },
              { method: 'POST', path: '/api/v1/apps/authentication', description: 'Save new auth from inside the flow' },
              { method: 'GET', path: '/api/v1/datastore', description: 'Persist selected tools + automation config per org' },
              { method: 'POST', path: '/api/v1/datastore', description: 'Write onboarding selections back to the org datastore' },
            ]}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, overflow: 'hidden' }}>
              <OnboardingFlow product="security" showProductChoice={false} />
            </Box>
          </DemoSection>

          <DemoSection
            title="4. Product choice step"
            description={<><code>&lt;ProductChoiceStep /&gt;</code> — just the standalone "Which Shuffle are you using?" picker. Useful when you want to embed it outside the full flow.</>}
            code={SNIPPET_PRODUCT_CHOICE}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, p: 2 }}>
              <ProductChoiceStep
                onSelect={(p) => console.log('picked', p)}
                coreRedirectUrl="https://shuffler.io/onboarding"
                securityRedirectUrl="https://security.shuffler.io/onboarding"
              />
            </Box>
          </DemoSection>

          <DemoSection
            title="5. Form input"
            description={<><code>&lt;FormInput /&gt;</code> — the public-facing form runner used to collect <code>form_control.input_questions</code> for a workflow before triggering it.</>}
            code={SNIPPET_FORM_INPUT}
            apis={[
              { method: 'GET', path: '/api/v1/workflows/:id', description: 'Load the workflow and its form definition' },
              { method: 'POST', path: '/api/v1/workflows/:id/execute', description: 'Submit form responses and trigger the run' },
            ]}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, p: 2 }}>
              <FormInput workflow={SAMPLE_WORKFLOW} isLoaded />
            </Box>
          </DemoSection>

          <DemoSection
            title="6. Recent workflow card"
            description={<><code>&lt;RecentWorkflow /&gt;</code> — the sidebar / dashboard card that surfaces a recently edited workflow. Pure presentational; pass any workflow object.</>}
            code={SNIPPET_RECENT_WORKFLOW}
          >
            <Box sx={{ border: '1px solid hsl(var(--border))', borderRadius: 1.5, p: 2, maxWidth: 380 }}>
              <RecentWorkflow workflow={SAMPLE_WORKFLOW} leftNavOpen />
            </Box>
          </DemoSection>

          <DemoSection
            title="7. Edit workflow"
            description={<><code>&lt;EditWorkflow /&gt;</code> — the create / edit workflow modal (name, description, tags, usecase mapping, form questions, due date, AI generation). Source-only here because it needs the host app's workflow + appFramework wiring.</>}
            code={SNIPPET_EDIT_WORKFLOW}
          />
        </Stack>
      </Container>
    </>
  );
};

export default ShuffleCoreTestPage;
