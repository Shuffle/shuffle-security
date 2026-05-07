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

type LegacyOptions = {
  description?: React.ReactNode;
  duration?: number;
} & Omit<ToastOptions, 'autoClose'>;

const buildContent = (message: ToastContent, description?: React.ReactNode): ToastContent => {
  if (description === undefined || description === null || description === '') return message;
  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
    React.createElement('div', { style: { fontWeight: 600 } }, message as React.ReactNode),
    React.createElement(
      'div',
      { style: { fontSize: '0.85em', opacity: 0.85 } },
      description,
    ),
  );
};

const mapOptions = (opts?: LegacyOptions): ToastOptions | undefined => {
  if (!opts) return undefined;
  const { description: _d, duration, ...rest } = opts;
  const out: ToastOptions = { ...rest };
  if (typeof duration === 'number') out.autoClose = duration;
  return out;
};

const baseToast = (message: ToastContent, opts?: LegacyOptions) =>
  rtToast(buildContent(message, opts?.description), mapOptions(opts));

export const toast = Object.assign(baseToast, {
  success: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.success(buildContent(message, opts?.description), mapOptions(opts)),
  error: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.error(buildContent(message, opts?.description), mapOptions(opts)),
  info: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.info(buildContent(message, opts?.description), mapOptions(opts)),
  warning: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.warning(buildContent(message, opts?.description), mapOptions(opts)),
  message: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast(buildContent(message, opts?.description), mapOptions(opts)),
  dismiss: (id?: string | number) => rtToast.dismiss(id as never),
  promise: rtToast.promise.bind(rtToast),
  loading: (message: ToastContent, opts?: LegacyOptions) =>
    rtToast.loading(buildContent(message, opts?.description), mapOptions(opts)),
});

export default toast;
