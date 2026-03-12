import { useRef, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

interface HighlightedFileEditorProps {
  value: string;
  onChange: (value: string) => void;
  validateJson?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlightLine = (line: string): string => {
  const escaped = escapeHtml(line);

  if (/^\s*(\/\/|#)/.test(escaped)) {
    return `<span class="hl-comment">${escaped}</span>`;
  }

  let result = escaped;

  result = result.replace(
    /(\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
    '<span class="hl-variable">$1</span>'
  );

  result = result.replace(
    /(&quot;)([^&]*?)(&quot;)\s*:/g,
    '<span class="hl-key">$1$2$3</span>:'
  );

  result = result.replace(
    /(&quot;)((?:(?!&quot;).)*)(&quot;)/g,
    '<span class="hl-string">$1$2$3</span>'
  );

  result = result.replace(
    /\b(true|false|null)\b/g,
    '<span class="hl-literal">$1</span>'
  );

  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="hl-number">$1</span>'
  );

  return result;
};

const buildHighlightedHtml = (text: string): string => {
  return text.split('\n').map(highlightLine).join('\n') + '\n';
};

const HighlightedFileEditor = ({ value, onChange, validateJson = true, onValidationChange }: HighlightedFileEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const jsonError = useMemo(() => {
    if (!validateJson) return null;
    if (!value.trim()) return 'JSON is required';

    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      const msg = e.message || 'Invalid JSON';
      const match = msg.match(/position (\d+)/);

      if (match) {
        const pos = parseInt(match[1], 10);
        const before = value.substring(0, pos);
        const line = before.split('\n').length;
        return `Line ${line}: ${msg}`;
      }

      return msg;
    }
  }, [value, validateJson]);

  const isValid = !validateJson || jsonError === null;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const highlighted = buildHighlightedHtml(value);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: `1px solid ${jsonError ? 'hsl(var(--destructive) / 0.6)' : 'hsl(var(--border))'}`,
          transition: 'border-color 0.2s ease',
        }}
      >
        <Box
          ref={backdropRef}
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            bgcolor: 'hsl(var(--muted) / 0.35)',
            p: '14px',
            '& .hl-comment': {
              color: 'hsl(var(--muted-foreground) / 0.8)',
              fontStyle: 'italic',
            },
            '& .hl-variable': {
              color: 'hsl(var(--primary))',
              fontWeight: 600,
            },
            '& .hl-key': {
              color: 'hsl(var(--muted-foreground) / 0.95)',
            },
            '& .hl-string': {
              color: 'hsl(var(--foreground) / 0.78)',
            },
            '& .hl-literal': {
              color: 'hsl(var(--destructive) / 0.9)',
              fontWeight: 500,
            },
            '& .hl-number': {
              color: 'hsl(var(--primary) / 0.85)',
            },
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
              color: 'transparent',
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </Box>

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
            color: 'hsl(var(--foreground) / 0.05)',
            caretColor: 'hsl(var(--primary))',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'auto',
          }}
        />
      </Box>

      {jsonError ? (
        <Typography
          variant="caption"
          sx={{
            color: 'hsl(var(--destructive))',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            mt: 0.5,
            px: 1,
          }}
        >
          ⚠ {jsonError}
        </Typography>
      ) : (
        validateJson && (
          <Typography
            variant="caption"
            sx={{
              color: 'hsl(var(--primary))',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              mt: 0.5,
              px: 1,
            }}
          >
            ✓ Valid JSON
          </Typography>
        )
      )}
    </Box>
  );
};

export default HighlightedFileEditor;
