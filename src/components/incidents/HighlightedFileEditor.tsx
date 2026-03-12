import { useEffect, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, MatchDecorator } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Decorator that highlights $variable.path patterns inside strings
const variableMark = Decoration.mark({ class: 'cm-variable-token' });
const variableMatcher = new MatchDecorator({
  regexp: /\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g,
  decoration: () => variableMark,
});
const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = variableMatcher.createDeco(view as any); }
    update(update: ViewUpdate) { this.decorations = variableMatcher.updateDeco(update, this.decorations); }
  },
  { decorations: (v) => v.decorations }
);

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
  { tag: [t.bool, t.null], color: 'hsl(var(--destructive))', fontWeight: '500' },
  { tag: [t.brace, t.squareBracket], color: 'hsl(var(--severity-medium))', fontWeight: '600' },
  { tag: [t.punctuation, t.separator], color: 'hsl(var(--foreground-muted))' },
]);

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'hsl(var(--background-elevated) / 0.98) !important',
      color: 'hsl(var(--foreground))',
      fontSize: '0.75rem',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      fontFamily: 'JetBrains Mono, monospace',
      caretColor: 'hsl(var(--primary))',
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
    '.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'hsl(var(--primary) / 0.2) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'hsl(var(--primary))',
      borderLeftWidth: '2px',
    },
    '.cm-activeLine': {
      backgroundColor: 'hsl(var(--secondary) / 0.45)',
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(var(--background) / 0.8) !important',
      color: 'hsl(var(--foreground-muted))',
      border: 'none',
      paddingRight: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'hsl(var(--foreground) / 0.55)',
    },
    '.cm-foldGutter': {
      color: 'hsl(var(--foreground-muted))',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'hsl(var(--primary) / 0.2)',
      outline: '1px solid hsl(var(--primary) / 0.45)',
      color: 'hsl(var(--severity-medium))',
    },
    '.cm-variable-token': {
      color: 'hsl(var(--primary))',
      fontWeight: '600',
    },
  },
  { dark: true }
);

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

  const extensions = useMemo(() => [json(), syntaxHighlighting(jsonHighlight), EditorView.lineWrapping], []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box
        sx={{
          borderRadius: 1.5,
          overflow: 'hidden',
          border: `1px solid ${jsonError ? 'hsl(var(--destructive) / 0.6)' : 'hsl(var(--border))'}`,
          transition: 'border-color 0.2s ease',
          '& .cm-editor': {
            backgroundColor: 'hsl(var(--background-elevated) / 0.98) !important',
          },
          '& .cm-scroller': {
            backgroundColor: 'transparent !important',
          },
          '& .cm-gutters': {
            backgroundColor: 'hsl(var(--background) / 0.8) !important',
          },
        }}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          theme={editorTheme}
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
