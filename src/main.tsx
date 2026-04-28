import { createRoot } from "react-dom/client";
import "./index.css";

const SERVICE_WORKER_CLEANUP_KEY = "shuffle-service-worker-cleaned";

const cleanupServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (navigator.serviceWorker.controller && sessionStorage.getItem(SERVICE_WORKER_CLEANUP_KEY) !== "true") {
    sessionStorage.setItem(SERVICE_WORKER_CLEANUP_KEY, "true");
    window.location.reload();
    return new Promise<never>(() => undefined);
  }
};

const startApp = async () => {
  await cleanupServiceWorkers();
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
};

void startApp();
