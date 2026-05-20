import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installLocalStorageQuotaGuard } from "./utils/safeLocalStorage";
import { installWorkflowFetchGate } from "./lib/workflowFetchGate";

installLocalStorageQuotaGuard();
installWorkflowFetchGate();

const cleanupServiceWorkers = async (): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false;

  // Only treat this visit as "needed a reload" if an SW is actually
  // controlling the document right now. Leftover cache entries or stale
  // registrations are NOT a reason to refresh — we can clean them up
  // silently in the background.
  const hadActiveController = !!navigator.serviceWorker.controller;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
  } catch {
    // ignore
  }

  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((n) => caches.delete(n).catch(() => false)));
    } catch {
      // ignore
    }
  }

  return hadActiveController;
};

// Render immediately — never gate the app on SW cleanup or a dynamic import.
createRoot(document.getElementById("root")!).render(<App />);

// Run SW cleanup in the background. Only force a one-time reload if a SW
// was actively controlling this document (it would intercept module fetches).
// Use sessionStorage so we don't loop-reload across the SW's own
// `client.navigate(?sw-cleanup=...)` step.
void cleanupServiceWorkers().then((hadActiveController) => {
  if (!hadActiveController) return;
  try {
    if (sessionStorage.getItem("__swCleaned") === "1") return;
    sessionStorage.setItem("__swCleaned", "1");
  } catch {
    // sessionStorage may be unavailable; fall through and reload once.
  }
  window.location.reload();
});
