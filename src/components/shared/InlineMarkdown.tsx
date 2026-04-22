/**
 * InlineMarkdown — renders a short markdown string inline (no <p> wrappers,
 * no block elements). Designed for titles, chips and one-liner labels where
 * we still want **bold**, _italic_, `code` and [links](url) to render.
 *
 * Backed by react-markdown, but every block-level element is mapped to a
 * lightweight inline equivalent so the output stays on a single line and
 * inherits the surrounding Typography styling.
 */

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface InlineMarkdownProps {
  text: string;
  /** Optional className passed onto the wrapping <span>. */
  className?: string;
}

const inlineComponents: Components = {
  // Strip block wrappers — render their children inline.
  p: ({ children }) => <>{children}</>,
  h1: ({ children }) => <>{children}</>,
  h2: ({ children }) => <>{children}</>,
  h3: ({ children }) => <>{children}</>,
  h4: ({ children }) => <>{children}</>,
  h5: ({ children }) => <>{children}</>,
  h6: ({ children }) => <>{children}</>,
  ul: ({ children }) => <>{children}</>,
  ol: ({ children }) => <>{children}</>,
  li: ({ children }) => <>{children} </>,
  blockquote: ({ children }) => <>{children}</>,
  pre: ({ children }) => <>{children}</>,
  hr: () => <> — </>,
  br: () => <> </>,
  // Keep inline formatting.
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code style={{
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.92em',
      padding: '0 4px',
      borderRadius: 3,
      backgroundColor: 'hsl(var(--muted))',
    }}>{children}</code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  ),
};

export const InlineMarkdown = ({ text, className }: InlineMarkdownProps) => {
  return (
    <span className={className}>
      <ReactMarkdown components={inlineComponents}>{text || ''}</ReactMarkdown>
    </span>
  );
};

export default InlineMarkdown;
