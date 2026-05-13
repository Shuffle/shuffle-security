/**
 * Unified toast wrapper backed by react-toastify.
 *
 * Exposes the same surface area we previously consumed from `sonner` and
 * `@/hooks/use-toast` so existing call sites keep working:
 *   toast('Message')
 *   toast.success('Title', { description: '...', duration: 3000 })
 *   toast.error(...)  toast.info(...)  toast.warning(...)
 */
import React from 'react';
import { toast as rtToast, type ToastOptions, type ToastContent } from 'react-toastify';

type ToastButton = { label: React.ReactNode; onClick?: () => void } | undefined;

type LegacyOptions = {
  description?: React.ReactNode;
  duration?: number;
  title?: React.ReactNode;
  action?: ToastButton;
  cancel?: ToastButton;
  id?: string | number;
  [key: string]: unknown;
};

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: '0.8em',
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: 1.2,
};

const renderActions = (
  toastId: string | number | undefined,
  action: ToastButton,
  cancel: ToastButton,
): React.ReactNode => {
  if (!action && !cancel) return null;
  const handleClick = (cb: (() => void) | undefined) => () => {
    try { cb?.(); } finally { if (toastId !== undefined) rtToast.dismiss(toastId as never); }
  };
  return React.createElement(
    'div',
    { style: { display: 'flex', gap: 8, marginTop: 8 } },
    cancel
      ? React.createElement(
          'button',
          { type: 'button', style: buttonStyle, onClick: handleClick(cancel.onClick) },
          cancel.label,
        )
      : null,
    action
      ? React.createElement(
          'button',
          {
            type: 'button',
            style: { ...buttonStyle, background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary))' },
            onClick: handleClick(action.onClick),
          },
          action.label,
        )
      : null,
  );
};

const buildContent = (
  message: ToastContent,
  opts?: LegacyOptions,
): ToastContent => {
  const description = opts?.description;
  const actions = renderActions(opts?.id, opts?.action, opts?.cancel);
  if (!description && !actions) return message;
  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
    React.createElement('div', { style: { fontWeight: 600 } }, message as React.ReactNode),
    description
      ? React.createElement('div', { style: { fontSize: '0.85em', opacity: 0.85 } }, description)
      : null,
    actions,
  );
};

const mapOptions = (opts?: LegacyOptions): ToastOptions | undefined => {
  if (!opts) return undefined;
  const { description: _d, duration, title: _t, action: _a, cancel: _c, id, ...rest } = opts;
  const out: ToastOptions = { ...(rest as ToastOptions) };
  if (typeof duration === 'number') {
    // react-toastify uses `false` for sticky; Infinity is invalid and causes
    // the toast to auto-close immediately with the default timer.
    out.autoClose = Number.isFinite(duration) ? duration : false;
  }
  if (id !== undefined) out.toastId = id;
  return out;
};

const baseToast = (message: ToastContent, opts?: LegacyOptions) =>
  rtToast(buildContent(message, opts), mapOptions(opts));

export const toast = Object.assign(baseToast, {
  success: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.success(buildContent(message, opts), mapOptions(opts)),
  error: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.error(buildContent(message, opts), mapOptions(opts)),
  info: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.info(buildContent(message, opts), mapOptions(opts)),
  warning: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.warning(buildContent(message, opts), mapOptions(opts)),
  message: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast(buildContent(message, opts), mapOptions(opts)),
  dismiss: (id?: string | number) => rtToast.dismiss(id as never),
  promise: rtToast.promise.bind(rtToast),
  loading: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.loading(buildContent(message, opts), mapOptions(opts)),
});

export default toast;
