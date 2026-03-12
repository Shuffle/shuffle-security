import { useRef, useCallback } from 'react';
import { Box } from '@mui/material';

interface HighlightedFileEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Syntax-highlighted editor using textarea + backdrop overlay.
 * Highlights:
 * - $variable.path.refs in orange
 * - "strings" in green
 * - JSON keys ("key":) in cyan
 * - numbers in purple
 * - true/false/null in red
 * - comments (// and #) in grey
 */
const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlightLine = (line: string): string => {
  const escaped = escapeHtml(line);

  // Comment lines
  if (/^\s*(\/\/|#)/.test(escaped)) {
    return `<span style="color:#6b7280;font-style:italic">${escaped}</span>`;
  }

  let result = escaped;

  // $variable.field.subfield (before other replacements to avoid conflicts)
  result = result.replace(
    /(\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
    '<span style="color:#ff6600;font-weight:600;background:rgba(255,102,0,0.12);padding:0 2px;border-radius:2px">$1</span>'
  );

  // JSON key ("key":)
  result = result.replace(
    /(&quot;)([^&]*?)(&quot;)\s*:/g,
    '<span style="color:#67e8f9">$1$2$3</span>:'
  );

  // Remaining quoted strings
  result = result.replace(
    /(&quot;)((?:(?!&quot;).)*)(&quot;)/g,
    '<span style="color:#4ade80">$1$2$3</span>'
  );

  // Booleans and null
  result = result.replace(
    /\b(true|false|null)\b/g,
    '<span style="color:#f87171;font-weight:500">$1</span>'
  );

  // Numbers (standalone)
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span style="color:#c084fc">$1</span>'
  );

  return result;
};

const buildHighlightedHtml = (text: string): string => {
  return text.split('\n').map(highlightLine).join('\n') + '\n';
};

const HighlightedFileEditor = ({ value, onChange }: HighlightedFileEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const highlighted = buildHighlightedHtml(value);

  return (
    <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Highlighted backdrop */}
      <Box
        ref={backdropRef}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          bgcolor: 'rgba(0,0,0,0.3)',
          p: '14px',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: 'transparent', // fallback
          }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </Box>

      {/* Transparent textarea on top */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: 480,
          padding: '14px',
          margin: 0,
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          background: 'transparent',
          color: 'rgba(255,255,255,0.05)', // nearly invisible - backdrop shows through
          caretColor: '#ff6600',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflow: 'auto',
        }}
      />
    </Box>
  );
};

export default HighlightedFileEditor;
