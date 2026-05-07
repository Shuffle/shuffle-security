// Legacy shadcn sonner shim — replaced by react-toastify (see src/App.tsx).
// Kept only so any stragglers importing from here still resolve.
import { ToastContainer } from 'react-toastify';
import { toast } from '@/lib/toast';

export const Toaster = ToastContainer;
export { toast };
