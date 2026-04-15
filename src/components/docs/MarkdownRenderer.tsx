import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// Import markdown files statically
const docs: Record<string, () => Promise<{ default: string }>> = {
  index: () => import('@/docs/index.md?raw'),
  'getting-started': () => import('@/docs/getting-started.md?raw'),
  'incident-creation': () => import('@/docs/incident-creation.md?raw'),
  'shuffle-pipelines': () => import('@/docs/shuffle-pipelines.md?raw'),
  monitoring: () => import('@/docs/monitoring.md?raw'),
  setup: () => import('@/docs/setup.md?raw'),
};

interface MarkdownRendererProps {
  slug?: string;
}

export const MarkdownRenderer = ({ slug = 'index' }: MarkdownRendererProps) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const loader = docs[slug];
        if (!loader) {
          setError(`Documentation not found: ${slug}`);
          setLoading(false);
          return;
        }
        
        const module = await loader();
        setContent(module.default);
      } catch (err) {
        console.error('Failed to load markdown:', err);
        setError('Failed to load documentation');
      } finally {
        setLoading(false);
      }
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
