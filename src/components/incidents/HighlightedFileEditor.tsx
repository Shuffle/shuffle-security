import { useRef, useCallback, useMemo } from 'react';
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

  // Comment lines
  if (/^\s*(\/\/|#)/.test(escaped)) {
    return `<span style="color:#6b7280;font-style:italic">${escaped}</span>`;
  }

  let result = escaped;

  // $variable.field.subfield
  result = result.replace(
    /(\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
    '<span style="color:#93c5fd;font-weight:500">$1</span>'
  );

  // JSON key ("key":)
  result = result.replace(
    /(&quot;)([^&]*?)(&quot;)\s*:/g,
    '<span style="color:#d1d5db">$1$2$3</span>:'
  );

  // Remaining quoted strings
  result = result.replace(
    /(&quot;)((?:(?!&quot;).)*)(&quot;)/g,
    '<span style="color:#86efac">$1$2$3</span>'
  );

  // Booleans and null
  result = result.replace(
    /\b(true|false|null)\b/g,
    '<span style="color:#fca5a5">$1</span>'
  );

  // Numbers (standalone)
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span style="color:#fcd34d">$1</span>'
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
    if (!validateJson || !value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      const msg = e.message || 'Invalid JSON';
      // Extract position info if available
      const match = msg.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const before = value.substring(0, pos);
        const line = before.split('\n').length;
        return `Line ${line}: ${msg}`;
      }
      return msg;
    }
  }, [value, validateJson]);

  const isValid = !validateJson || jsonError === null;

  // Notify parent of validation state
  useMemo(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const highlighted = buildHighlightedHtml(value);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box sx={{
        position: 'relative',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: `1px solid ${jsonError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.2s ease',
      }}>
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
              color: 'transparent',
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
            color: 'rgba(255,255,255,0.05)',
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
      {jsonError && (
        <Typography
          variant="caption"
          sx={{
            color: '#ef4444',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            mt: 0.5,
            px: 1,
          }}
        >
          ⚠ {jsonError}
        </Typography>
      )}
      {validateJson && !jsonError && value.trim() && (
        <Typography
          variant="caption"
          sx={{
            color: '#4ade80',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            mt: 0.5,
            px: 1,
          }}
        >
          ✓ Valid JSON
        </Typography>
      )}
    </Box>
  );
};

export default HighlightedFileEditor;
