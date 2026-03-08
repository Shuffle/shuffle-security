/**
 * Shared in-memory state for tracking which incidents are currently resyncing.
 * Survives route navigations but resets on page refresh.
 */

type Listener = () => void;

const resyncingIds = new Set<string>();
const listeners = new Set<Listener>();

const notify = () => listeners.forEach(fn => fn());

export const resyncState = {
  add(id: string) {
    resyncingIds.add(id);
    notify();
  },
  remove(id: string) {
    resyncingIds.delete(id);
    notify();
  },
  has(id: string) {
    return resyncingIds.has(id);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Current snapshot */
  getAll(): Set<string> {
    return new Set(resyncingIds);
  },
};
