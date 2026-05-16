/**
 * FormInputStubs — local dummy implementations for dependencies that the
 * original Shuffle Core `RunWorkflow.jsx` pulled in from sibling files
 * (`../views/AngularWorkflow.jsx`, `../views/Docs.jsx`, `../views/Workflows2.jsx`,
 * `../components/EditWorkflow.jsx`, `../components/RecentWorkflow.jsx`,
 * `../context/ContextApi.jsx`, `../theme.jsx`) plus a handful of npm packages
 * that are not installed in this app: `react-json-view-ssr`, `react-powerhooks`,
 * `react-device-detect`, `rehype-raw`.
 *
 * ⚠️  WHAT MAY NOT WORK
 *
 *   • EditWorkflow modal:        renders a "stubbed" placeholder — you cannot
 *                                edit the underlying workflow / form layout
 *                                from inside the form runner.
 *   • RecentWorkflow card:       renders a minimal MUI card. No live status,
 *                                no last-run timestamp, no preview image.
 *   • ReactJson viewer:          replaced with a plain <pre>JSON.stringify</pre>.
 *                                No collapse, no inline edit, no copy-on-click.
 *   • CodeHandler markdown:      basic <code>/<pre> rendering only — no syntax
 *                                highlighting, no copy button.
 *   • GetIconInfo:               returns a neutral placeholder — workflow
 *                                "trigger / app" icons in the form list are
 *                                generic.
 *   • rehype-raw plugin:         no-op identity transformer, so raw HTML
 *                                embedded in markdown will NOT be rendered.
 *   • isMobile:                  computed from window.innerWidth at module
 *                                load. No live re-evaluation on resize.
 *   • Theme palette:             fixed dark-mode token map — does not react
 *                                to the host app's theme switcher.
 *   • Context (themeMode/brandColor/supportEmail): fixed constants.
 *
 * Everything else (form validation, workflow execution, polling, agentic
 * decision continuation, markdown question rendering, sharing dialog, sidebar
 * form list) should behave identically to the original.
 */

import React from 'react';
import { Box, Card, CardActionArea, Typography, Dialog, DialogTitle, DialogContent, Button } from '@mui/material';

/* ── Color constants (from ../views/AngularWorkflow.jsx) ─────────────────── */
export const green = '#1ED760';
export const yellow = '#f6cb1c';
export const red = '#f85a3e';
export const grey = '#9e9e9e';

/* ── Docs.jsx exports ────────────────────────────────────────────────────── */
export const CodeHandler = (props: any) => {
  const { inline, className, children, ...rest } = props || {};
  if (inline) {
    return (
      <code
        style={{
          background: 'rgba(255,255,255,0.08)',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.85em',
        }}
        {...rest}
      >
        {children}
      </code>
    );
  }
  return (
    <pre
      style={{
        background: 'rgba(0,0,0,0.35)',
        padding: 12,
        borderRadius: 8,
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.85em',
      }}
    >
      <code className={className} {...rest}>{children}</code>
    </pre>
  );
};

export const Img = (props: any) => {
  const safe = { ...(props || {}) };
  delete safe.node;
  return <img alt={safe.alt || ''} {...safe} style={{ maxWidth: '100%', ...(safe.style || {}) }} />;
};

export const OuterLink = (props: any) => {
  const { node, ...rest } = props || {};
  return <a target="_blank" rel="noreferrer noopener" {...rest} />;
};

/* ── Workflows2.jsx helpers ──────────────────────────────────────────────── */
export const validateJson = (input: any): { valid: boolean; result: any; error?: string } => {
  if (input === undefined || input === null) return { valid: false, result: input };
  if (typeof input !== 'string') return { valid: true, result: input };
  try {
    return { valid: true, result: JSON.parse(input) };
  } catch (e: any) {
    return { valid: false, result: input, error: String(e?.message || e) };
  }
};

export const collapseField = (_jsonField: any): boolean => false;

export const GetIconInfo = (_app: any) => ({
  icon: null as React.ReactNode,
  color: grey,
});

/* ── EditWorkflow stub ───────────────────────────────────────────────────── */
export const EditWorkflow = (props: any) => {
  const open = !!(props?.modalOpen);
  const close = () => props?.setModalOpen?.(false);
  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Form (stub)</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Editing forms inline is not available in this build. The full editor
          lives in Shuffle Core and was not ported into Shuffle-Core yet.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Workflow: {props?.workflow?.name || props?.workflow?.id || '—'}
        </Typography>
        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Button onClick={close} variant="contained">Close</Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

/* ── RecentWorkflow stub ─────────────────────────────────────────────────── */
export const RecentWorkflow = (props: any) => {
  const wf = props?.workflow || {};
  const active = props?.currentWorkflowId && wf.id === props.currentWorkflowId;
  return (
    <Card
      sx={{
        background: active ? 'rgba(255,102,0,0.12)' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(255,102,0,0.6)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <CardActionArea onClick={props?.onclickHandler} sx={{ p: 1.25 }}>
        <Typography variant="body2" noWrap title={wf.name}>{wf.name || 'Untitled'}</Typography>
        {wf.description ? (
          <Typography variant="caption" color="text.secondary" noWrap title={wf.description}>
            {wf.description}
          </Typography>
        ) : null}
      </CardActionArea>
    </Card>
  );
};

/* ── ReactJson stub ──────────────────────────────────────────────────────── */
export const ReactJson = (props: any) => {
  const src = props?.src;
  let text = '';
  try { text = typeof src === 'string' ? src : JSON.stringify(src, null, 2); }
  catch { text = String(src); }
  return (
    <pre
      style={{
        background: 'rgba(0,0,0,0.35)',
        color: 'hsl(var(--foreground))',
        padding: 12,
        borderRadius: 8,
        overflow: 'auto',
        maxHeight: 400,
        fontSize: '0.8em',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        ...(props?.style || {}),
      }}
    >
      {text}
    </pre>
  );
};

/* ── useInterval (from react-powerhooks) ─────────────────────────────────── */
export const useInterval = (opts: { duration: number; startImmediate?: boolean; callback: () => void }) => {
  const ref = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const cbRef = React.useRef(opts.callback);
  cbRef.current = opts.callback;
  const start = React.useCallback(() => {
    if (ref.current) return;
    ref.current = setInterval(() => { try { cbRef.current?.(); } catch { /* ignore */ } }, opts.duration);
  }, [opts.duration]);
  const stop = React.useCallback(() => {
    if (ref.current) { clearInterval(ref.current); ref.current = null; }
  }, []);
  React.useEffect(() => {
    if (opts.startImmediate) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { start, stop };
};

/* ── isMobile (from react-device-detect) ─────────────────────────────────── */
export const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

/* ── rehypeRaw stub — no-op transformer ──────────────────────────────────── */
export const rehypeRaw = () => (tree: any) => tree;

/* ── Theme + Context stubs ───────────────────────────────────────────────── */
const _defaultPalette = {
  primaryColor: '#FF6600',
  secondary: '#FF6600',
  surfaceColor: 'hsl(var(--card))',
  inputColor: 'hsl(var(--muted))',
  borderRadius: 12,
  defaultImage: 'https://shuffler.io/images/no_image.png',
  jsonTheme: 'monokai',
  reactJsonStyle: { background: 'transparent' },
  jsonIconStyle: 'circle',
  jsonCollapseStringsAfterLength: 80,
  textFieldStyle: {},
};

export const getTheme = (_themeMode?: string, _brandColor?: string) => ({
  palette: _defaultPalette,
});

export const Context = React.createContext({
  themeMode: 'dark',
  brandColor: '#FF6600',
  supportEmail: 'support@shuffler.io',
});
