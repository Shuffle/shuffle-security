import { createRoot } from "react-dom/client";
import "./index.css";

const cleanupServiceWorkers = async (): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false;

  let hadController = !!navigator.serviceWorker.controller;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) hadController = true;
    await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
  } catch {
    // ignore
  }

  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) hadController = true;
      await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
    } catch {
      // ignore
    }
  }

  return hadController;
};

const startApp = async () => {
  const needsReload = await cleanupServiceWorkers();

  // If a SW was controlling this page, the current document was loaded
  // through it and module requests will keep 404'ing. Force a reload —
  // but only once per page load to avoid loops. Use a window-level flag
  // that resets on real navigation instead of sessionStorage (which can
  // persist across iframe reloads in the Lovable preview).
  if (needsReload && !(window as unknown as { __swCleaned?: boolean }).__swCleaned) {
    (window as unknown as { __swCleaned?: boolean }).__swCleaned = true;
    window.location.reload();
    return;
  }

  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
};

void startApp();
