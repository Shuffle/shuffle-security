/**
 * Tiny toast facade — library version. Mirrors the sonner-style surface
 * (`toast(...)`, `toast.success`, `toast.error`, `toast.info`, `toast.warning`)
 * plus the legacy `{ title, description, variant }` shape used elsewhere in
 * the host app. The host app can replace the impl via `setToastImpl()`.
 */

type Variant = 'default' | 'destructive' | 'success' | 'error' | 'info' | 'warning';
type ToastArg = string | { title?: string; description?: string; variant?: Variant };
type ToastOptions = { description?: string; [key: string]: unknown };

type ToastImpl = (arg: ToastArg, opts?: ToastOptions) => void;

const defaultImpl: ToastImpl = (arg, opts) => {
  const isObj = typeof arg === 'object' && arg !== null;
  const title = isObj ? arg.title : arg;
  const description = isObj ? arg.description : opts?.description;
  const variant: Variant = (isObj ? arg.variant : undefined) || 'default';
  const msg = [title, description].filter(Boolean).join(' — ');
  if (variant === 'destructive' || variant === 'error') console.error('[toast]', msg);
  else if (variant === 'warning') console.warn('[toast]', msg);
  else console.log('[toast]', msg);
};

let _impl: ToastImpl = defaultImpl;

export function setToastImpl(fn: ToastImpl) {
  _impl = fn;
}

type ToastApi = ((arg: ToastArg, opts?: ToastOptions) => void) & {
  success: (msg: string, opts?: ToastOptions) => void;
  error: (msg: string, opts?: ToastOptions) => void;
  info: (msg: string, opts?: ToastOptions) => void;
  warning: (msg: string, opts?: ToastOptions) => void;
};

const base = ((arg: ToastArg, opts?: ToastOptions) => _impl(arg, opts)) as ToastApi;
base.success = (msg, opts) => _impl({ title: msg, description: opts?.description, variant: 'success' }, opts);
base.error = (msg, opts) => _impl({ title: msg, description: opts?.description, variant: 'destructive' }, opts);
base.info = (msg, opts) => _impl({ title: msg, description: opts?.description, variant: 'info' }, opts);
base.warning = (msg, opts) => _impl({ title: msg, description: opts?.description, variant: 'warning' }, opts);

export const toast: ToastApi = base;
