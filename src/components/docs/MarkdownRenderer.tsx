import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Box, CircularProgress, Avatar, AvatarGroup, Tooltip, Stack, Typography, Link as MuiLink } from '@mui/material';
import { Clock as ClockIcon, Github as GithubIcon } from 'lucide-react';
import { getApiUrl } from '@/Shuffle-MCPs/api';

// Import markdown files statically
const docs: Record<string, () => Promise<{ default: string }>> = {
  index: () => import('@/docs/index.md?raw'),
  'getting-started': () => import('@/docs/getting-started.md?raw'),
  'incident-creation': () => import('@/docs/incident-creation.md?raw'),
  'shuffle-pipelines': () => import('@/docs/shuffle-pipelines.md?raw'),
  monitoring: () => import('@/docs/monitoring.md?raw'),
  setup: () => import('@/docs/setup.md?raw'),
};

interface Contributor {
  name?: string;
  url?: string;
  image?: string;
}

interface RemoteDocMeta {
  name?: string;
  contributors?: Contributor[];
  read_time?: number;
  edited?: string;
  link?: string;
}

interface MarkdownRendererProps {
  slug?: string;
}

// Fetch a doc from the Shuffle Core /api/v1/docs/{name} endpoint.
// The API returns { success, reason: <markdown>, meta: {...} }.
const fetchRemoteDoc = async (
  slug: string,
): Promise<{ markdown: string; meta: RemoteDocMeta | null } | null> => {
  // Remote docs use underscores (e.g. getting_started); our local slugs use dashes.
  const candidates = Array.from(new Set([slug, slug.replace(/-/g, '_')]));
  for (const name of candidates) {
    try {
      const res = await fetch(getApiUrl(`/api/v1/docs/${encodeURIComponent(name)}`));
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.success && typeof data.reason === 'string' && data.reason.trim().length > 0) {
        return { markdown: data.reason, meta: (data.meta as RemoteDocMeta) ?? null };
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
};

export const MarkdownRenderer = ({ slug = 'index' }: MarkdownRendererProps) => {
  const [content, setContent] = useState<string>('');
  const [meta, setMeta] = useState<RemoteDocMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setMeta(null);

      const loader = docs[slug];
      if (loader) {
        try {
          const module = await loader();
          setContent(module.default);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Local markdown load failed, falling back to remote:', err);
        }
      }

      // Fallback: fetch from Shuffle Core docs API
      const remote = await fetchRemoteDoc(slug);
      if (remote) {
        setContent(remote.markdown);
        setMeta(remote.meta);
      } else {
        setError(`Documentation not found: ${slug}`);
      }
      setLoading(false);
    };

    loadContent();
  }, [slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: 'error.main' }}>
        {error}
      </Box>
    );
  }

  return (
    <Box
      className="prose prose-invert max-w-none"
      sx={{
        '& h1': {
          color: 'text.primary',
          fontSize: '2.25rem',
          fontWeight: 700,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
          mb: 4,
        },
        '& h2': {
          color: 'text.primary',
          fontSize: '1.5rem',
          fontWeight: 600,
          mt: 6,
          mb: 3,
        },
        '& h3': {
          color: 'text.primary',
          fontSize: '1.25rem',
          fontWeight: 600,
          mt: 4,
          mb: 2,
        },
        '& p': {
          color: 'text.secondary',
          lineHeight: 1.8,
          mb: 2,
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
        '& code': {
          backgroundColor: 'rgba(255, 102, 0, 0.1)',
          color: 'primary.main',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: '0.875rem',
          fontFamily: 'JetBrains Mono, monospace',
        },
        '& pre': {
          backgroundColor: (t) => t.palette.mode === 'dark' ? '#0D0D0D' : '#f5f5f5',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 3,
          overflow: 'auto',
          '& code': {
            backgroundColor: 'transparent',
            p: 0,
            color: 'text.primary',
          },
        },
        '& ul, & ol': {
          color: 'text.secondary',
          pl: 3,
          mb: 3,
        },
        '& li': {
          mb: 1,
        },
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          mb: 4,
        },
        '& th': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '2px solid',
          borderColor: 'divider',
          p: 2,
          textAlign: 'left',
          fontWeight: 600,
          color: 'text.primary',
        },
        '& td': {
          borderBottom: '1px solid',
          borderColor: 'divider',
          p: 2,
          color: 'text.secondary',
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          pl: 3,
          ml: 0,
          fontStyle: 'italic',
          color: 'text.secondary',
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
          my: 6,
        },
      }}
    >
      {meta && (meta.contributors?.length || meta.read_time || meta.link) && (
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="wrap"
          sx={{
            mb: 4,
            pb: 3,
            borderBottom: '1px solid',
            borderColor: 'divider',
            rowGap: 1,
          }}
        >
          {meta.read_time ? (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
              <ClockIcon size={14} />
              <Typography variant="caption">{meta.read_time} min read</Typography>
            </Stack>
          ) : null}

          {meta.contributors && meta.contributors.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Contributors
              </Typography>
              <AvatarGroup max={6} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.7rem', border: '1px solid', borderColor: 'divider' } }}>
                {meta.contributors.map((c, i) => {
                  const handle = c.url?.split('/').filter(Boolean).pop() || c.name || 'contributor';
                  const avatar = (
                    <Avatar key={c.url || i} src={c.image} alt={handle}>
                      {handle.charAt(0).toUpperCase()}
                    </Avatar>
                  );
                  return (
                    <Tooltip key={c.url || i} title={handle} arrow>
                      {c.url ? (
                        <MuiLink href={c.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex' }}>
                          {avatar}
                        </MuiLink>
                      ) : avatar}
                    </Tooltip>
                  );
                })}
              </AvatarGroup>
            </Stack>
          )}

          {meta.link && (
            <MuiLink
              href={meta.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                ml: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <GithubIcon size={14} />
              Edit on GitHub
            </MuiLink>
          )}
        </Stack>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            // Handle internal links
            if (href?.startsWith('/')) {
              return <Link to={href}>{children}</Link>;
            }
            // External links
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};
