import { useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

interface HighlightedFileEditorProps {
  value: string;
  onChange: (value: string) => void;
  validateJson?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

const jsonHighlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'hsl(var(--foreground))' },
  { tag: t.string, color: 'hsl(var(--status-resolved))' },
  { tag: t.number, color: 'hsl(var(--infra-email))' },
  { tag: [t.bool, t.null], color: 'hsl(var(--destructive))' },
  { tag: [t.brace, t.squareBracket], color: 'hsl(var(--severity-medium))' },
  { tag: [t.punctuation, t.separator], color: 'hsl(var(--foreground-muted))' },
]);

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'hsl(var(--background-elevated))',
    fontSize: '0.75rem',
  },
  '.cm-content': {
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: 'hsl(var(--primary))',
  },
  '.cm-line': {
    lineHeight: '1.6',
  },
  '.cm-scroller': {
    minHeight: '480px',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'hsl(var(--primary))',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--secondary) / 0.45)',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground-muted))',
    borderRight: '1px solid hsl(var(--border))',
  },
});

const getJsonError = (value: string, validateJson: boolean): string | null => {
  if (!validateJson) return null;
  if (!value.trim()) return 'JSON is required';

  try {
    JSON.parse(value);
    return null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const positionMatch = message.match(/position (\d+)/i);

    if (positionMatch) {
      const position = Number(positionMatch[1]);
      const line = value.slice(0, position).split('\n').length;
      return `Line ${line}: ${message}`;
    }

    return message;
  }
};

const HighlightedFileEditor = ({ value, onChange, validateJson = true, onValidationChange }: HighlightedFileEditorProps) => {
  const jsonError = useMemo(() => getJsonError(value, validateJson), [value, validateJson]);
  const isValid = !validateJson || jsonError === null;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const extensions = useMemo(
    () => [json(), syntaxHighlighting(jsonHighlight), editorTheme, EditorView.lineWrapping],
    []
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box
        sx={{
          borderRadius: 1.5,
          overflow: 'hidden',
          border: `1px solid ${jsonError ? 'hsl(var(--destructive) / 0.6)' : 'hsl(var(--border))'}`,
          transition: 'border-color 0.2s ease',
        }}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
          }}
          editable
        />
      </Box>

      {jsonError ? (
        <Typography
          variant="caption"
          sx={{
            color: 'hsl(var(--destructive))',
            fontFamily: 'JetBrains Mono, monospace',
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
              fontFamily: 'JetBrains Mono, monospace',
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
