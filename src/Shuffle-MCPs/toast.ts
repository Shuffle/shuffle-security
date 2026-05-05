/**
 * Tiny toast facade — library version. The host app can replace this by
 * setting a custom impl via setToastImpl(). Falls back to console.warn.
 */

type ToastArg = { title?: string; description?: string; variant?: 'default' | 'destructive' };
type ToastFn = (arg: ToastArg) => void;

let _impl: ToastFn = ({ title, description, variant }) => {
  const msg = [title, description].filter(Boolean).join(' — ');
  if (variant === 'destructive') console.error('[toast]', msg);
  else console.log('[toast]', msg);
};

export function setToastImpl(fn: ToastFn) {
  _impl = fn;
}

export const toast: ToastFn = (arg) => _impl(arg);
