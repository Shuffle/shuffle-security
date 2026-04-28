import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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

// Render immediately — never gate the app on SW cleanup or a dynamic import.
createRoot(document.getElementById("root")!).render(<App />);

// Run SW cleanup in the background. Only force a one-time reload if a SW
// was actively controlling this document (it would intercept module fetches).
void cleanupServiceWorkers().then((hadController) => {
  const flag = window as unknown as { __swCleaned?: boolean };
  if (hadController && !flag.__swCleaned) {
    flag.__swCleaned = true;
    window.location.reload();
  }
});
