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
  { tag: t.propertyName, color: '#e2e8f0' },
  { tag: t.string, color: '#a5d6a7' },
  { tag: t.number, color: '#ce93d8' },
  { tag: [t.bool, t.null], color: '#ef9a9a', fontWeight: '500' },
  { tag: [t.brace, t.squareBracket], color: '#ffd54f', fontWeight: '600' },
  { tag: [t.punctuation, t.separator], color: '#90a4ae' },
]);

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    fontSize: '0.75rem',
  },
  '.cm-content': {
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: 'hsl(24, 100%, 50%)',
    padding: '14px 0',
  },
  '.cm-line': {
    lineHeight: '1.6',
    padding: '0 14px',
  },
  '.cm-scroller': {
    minHeight: '480px',
    overflow: 'auto',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'hsla(24, 100%, 50%, 0.2) !important',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'hsl(24, 100%, 50%)',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsla(0, 0%, 100%, 0.03)',
  },
  '.cm-gutters': {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: 'hsla(0, 0%, 100%, 0.25)',
    border: 'none',
    paddingRight: '4px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'hsla(0, 0%, 100%, 0.5)',
  },
  '.cm-foldGutter': {
    color: 'hsla(0, 0%, 100%, 0.2)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'hsla(24, 100%, 50%, 0.25)',
    outline: '1px solid hsla(24, 100%, 50%, 0.4)',
    color: '#ffd54f !important',
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
