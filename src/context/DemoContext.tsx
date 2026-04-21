/**
 * Demo Mode global state — drives both the dashboard CTA and the floating
 * tour drawer. Mounted once in App.tsx so it survives route changes.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { seedForStep, cleanupDemoData, isDemoActive, getDemoStats } from '@/services/demoMode';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  route?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your demo',
    body: "We've seeded 8 incidents, 6 assets, and 5 users into your account so you can explore. Use Next/Previous to walk through the platform — you can also click around freely.",
    route: '/dashboard',
  },
  {
    id: 'incidents-list',
    title: 'Incidents',
    body: 'This is your incident queue. Each row shows severity, the source tool that detected it, who it\'s assigned to, and current status. Try opening a critical one.',
    route: '/incidents',
  },
  {
    id: 'incident-detail',
    title: 'Inside an incident',
    body: 'Open any incident to see the full picture: description, observables (IPs, hashes, users), tasks for the responder, and a chronological activity feed including AI agent actions.',
  },
  {
    id: 'assets',
    title: 'Assets',
    body: 'Assets are the devices and accounts you protect — laptops, servers, mobile devices, and cloud workloads. Each has a risk score so you know which to triage first.',
    route: '/assets',
  },
  {
    id: 'vulnerabilities',
    title: 'Vulnerabilities',
    body: 'Vulnerabilities aggregates findings from scanners (Qualys, Tenable, Snyk, AWS Config…) into one view. You filter by severity, source, or asset.',
    route: '/vulnerabilities',
  },
  {
    id: 'agent',
    title: 'AI Agent activity',
    body: 'When the AI agent investigates incidents or proposes high-stakes actions (like isolating a host), everything appears here for review and approval.',
    route: '/agent',
  },
  {
    id: 'wrap',
    title: 'You\'re all set',
    body: 'That\'s the tour. When you\'re ready to use real data, click "Clean up demo data" on the dashboard — we\'ll remove every sample item we created.',
    route: '/dashboard',
  },
];

interface DemoContextValue {
  active: boolean;
  isSeeding: boolean;
  isCleaning: boolean;
  drawerOpen: boolean;
  step: number;
  stats: { incidents: number; assets: number; users: number };
  startDemo: () => Promise<void>;
  openTour: () => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (i: number) => void;
  cleanup: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState(() => isDemoActive());
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState(() => getDemoStats());

  const refreshStats = useCallback(() => setStats(getDemoStats()), []);

  const navigateForStep = useCallback((i: number) => {
    const route = TOUR_STEPS[i]?.route;
    if (route && typeof window !== 'undefined' && window.location.pathname !== route) {
      navigate(route);
    }
  }, [navigate]);

  // Run the seeder for the given step (idempotent — no-op if already seeded).
  const runStepSeed = useCallback(async (i: number) => {
    const stepDef = TOUR_STEPS[i];
    if (!stepDef) return;
    try {
      const added = await seedForStep(stepDef.id);
      if (added > 0) {
        refreshStats();
        toast.success(`+${added} sample item${added === 1 ? '' : 's'} added`, { duration: 1800 });
      }
    } catch {
      toast.error('Failed to add sample data for this step.');
    }
  }, [refreshStats]);

  const startDemo = useCallback(async () => {
    setIsSeeding(true);
    try {
      // Mark active immediately so the dashboard CTA flips state, even before any data lands.
      localStorage.setItem('shuffle_demo_active', 'true');
      setActive(true);
      setStep(0);
      setDrawerOpen(true);
      toast.success('Demo started — data will appear as you tour the platform.');
      navigateForStep(0);
      await runStepSeed(0);
    } finally {
      setIsSeeding(false);
    }
  }, [navigateForStep, runStepSeed]);

  const openTour = useCallback(() => {
    setDrawerOpen(true);
    navigateForStep(step);
    runStepSeed(step);
  }, [navigateForStep, runStepSeed, step]);

  const closeTour = useCallback(() => setDrawerOpen(false), []);

  const nextStep = useCallback(() => {
    setStep(prev => {
      const next = Math.min(prev + 1, TOUR_STEPS.length - 1);
      navigateForStep(next);
      runStepSeed(next);
      return next;
    });
  }, [navigateForStep, runStepSeed]);

  const prevStep = useCallback(() => {
    setStep(prev => {
      const next = Math.max(prev - 1, 0);
      navigateForStep(next);
      runStepSeed(next);
      return next;
    });
  }, [navigateForStep, runStepSeed]);

  const goToStep = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(i, TOUR_STEPS.length - 1));
    setStep(clamped);
    navigateForStep(clamped);
    runStepSeed(clamped);
  }, [navigateForStep, runStepSeed]);

  const cleanup = useCallback(async () => {
    setIsCleaning(true);
    try {
      const res = await cleanupDemoData();
      setActive(false);
      setDrawerOpen(false);
      setStep(0);
      refreshStats();
      if (res.success) {
        toast.success(`Removed ${res.deleted} demo item${res.deleted === 1 ? '' : 's'}.`);
      } else {
        toast.warning(`Removed ${res.deleted} items, ${res.failed} failed. You can run cleanup again.`);
      }
      // Reload to clear any in-memory caches in hooks
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setIsCleaning(false);
    }
  }, [refreshStats]);

  // Re-sync active flag if changed in another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'shuffle_demo_active') {
        setActive(isDemoActive());
        refreshStats();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshStats]);

  const value = useMemo<DemoContextValue>(() => ({
    active, isSeeding, isCleaning, drawerOpen, step, stats,
    startDemo, openTour, closeTour, nextStep, prevStep, goToStep, cleanup,
  }), [active, isSeeding, isCleaning, drawerOpen, step, stats, startDemo, openTour, closeTour, nextStep, prevStep, goToStep, cleanup]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextValue => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
};
