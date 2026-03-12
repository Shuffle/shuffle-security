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

  // Single-pass tokenizer to avoid regex ordering conflicts
  const tokenRegex = /(\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)|((&quot;)((?:(?!&quot;).)*?)(&quot;))|\b(true|false|null)\b|\b(\d+\.?\d*(?:e[+\-]?\d+)?)\b|([{}\[\]])|([,:])/gi;

  let result = '';
  let lastIndex = 0;

  escaped.replace(tokenRegex, (match, variable, _fullStr, qOpen, strContent, qClose, literal, number, bracket, punct, offset) => {
    // Append any text before this match as base text
    result += escaped.slice(lastIndex, offset);
    lastIndex = offset + match.length;

    if (variable) {
      result += `<span class="hl-variable">${match}</span>`;
    } else if (qOpen) {
      // Check if next non-space is ":" → key, otherwise string
      const after = escaped.slice(lastIndex);
      if (/^\s*:/.test(after)) {
        result += `<span class="hl-key">${match}</span>`;
      } else {
        result += `<span class="hl-string">${match}</span>`;
      }
    } else if (literal) {
      result += `<span class="hl-literal">${match}</span>`;
    } else if (number) {
      result += `<span class="hl-number">${match}</span>`;
    } else if (bracket) {
      result += `<span class="hl-bracket">${match}</span>`;
    } else if (punct) {
      result += `<span class="hl-punctuation">${match}</span>`;
    } else {
      result += match;
    }

    return match; // unused, we build result manually
  });

  // Append any remaining text
  result += escaped.slice(lastIndex);

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
            bgcolor: 'rgba(0, 0, 0, 0.45)',
            p: '14px',
            '& .hl-comment': {
              color: '#6b7280',
              fontStyle: 'italic',
            },
            '& .hl-variable': {
              color: '#ff6600',
              fontWeight: 600,
            },
            '& .hl-key': {
              color: '#e2e8f0',
            },
            '& .hl-string': {
              color: '#a5d6a7',
            },
            '& .hl-literal': {
              color: '#ef9a9a',
              fontWeight: 500,
            },
            '& .hl-number': {
              color: '#ce93d8',
            },
            '& .hl-bracket': {
              color: '#ffd54f',
              fontWeight: 600,
            },
            '& .hl-punctuation': {
              color: '#90a4ae',
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
              color: '#cbd5e1',
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
