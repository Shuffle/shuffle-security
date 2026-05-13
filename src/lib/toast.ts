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

const baseButtonStyle: React.CSSProperties = {
  background: 'hsl(var(--muted) / 0.6)',
  border: '1px solid hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  lineHeight: 1.2,
  transition: 'background 120ms ease, border-color 120ms ease, transform 120ms ease',
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  borderColor: 'hsl(var(--primary))',
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
    { style: { display: 'flex', gap: 8, marginTop: 12 } },
    cancel
      ? React.createElement(
          'button',
          { type: 'button', style: baseButtonStyle, onClick: handleClick(cancel.onClick) },
          cancel.label,
        )
      : null,
    action
      ? React.createElement(
          'button',
          { type: 'button', style: primaryButtonStyle, onClick: handleClick(action.onClick) },
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
  const icon = opts?.icon as React.ReactNode | undefined;
  const actions = renderActions(opts?.id, opts?.action, opts?.cancel);
  if (!description && !actions && !icon) return message;

  const titleNode = React.createElement(
    'div',
    {
      style: {
        fontWeight: 600,
        fontSize: '0.9375rem',
        letterSpacing: '-0.01em',
        lineHeight: 1.35,
        color: 'hsl(var(--foreground))',
      },
    },
    message as React.ReactNode,
  );

  const descNode = description
    ? React.createElement(
        'div',
        {
          style: {
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            marginTop: 4,
            color: 'hsl(var(--muted-foreground))',
          },
        },
        description,
      )
    : null;

  const body = React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 } },
    titleNode,
    descNode,
    actions,
  );

  if (!icon) return body;

  return React.createElement(
    'div',
    { style: { display: 'flex', gap: 12, alignItems: 'flex-start' } },
    React.createElement(
      'div',
      {
        style: {
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(var(--primary) / 0.12)',
          color: 'hsl(var(--primary))',
        },
      },
      icon,
    ),
    body,
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
