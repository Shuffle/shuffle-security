/**
 * Demo Mode global state — drives both the dashboard CTA and the floating
 * tour drawer. Mounted once in App.tsx so it survives route changes.
 *
 * Some steps have a `requirement`: a real action the user must perform on the
 * page before the tour will let them advance. The drawer's Next button is
 * disabled until `completedSteps[stepId]` flips true, and a spotlight points
 * at the element identified by `targetSelector`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { seedForStep, cleanupDemoData, isDemoActive, getDemoStats } from '@/services/demoMode';
import { trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';

export interface TourStepRequirement {
  /** Short human label shown in the drawer (e.g. "Enable the ingestion webhook"). */
  label: string;
  /** CSS selector for the element the spotlight should point at. Use a stable `[data-tour="..."]` attr. */
  targetSelector: string;
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
  route?: string;
  /** If set, Next is disabled until completedSteps[id] is true. */
  requirement?: TourStepRequirement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your demo',
    body: "Heads up — this is a hands-on demo, not a sandbox. As you walk through, we'll actually enable apps in your account, seed real incidents, assets and users, and let an AI agent perform live actions on your approval. Use Next/Previous to advance, or click around freely. When you're done, hit \"Clean up demo data\" and every sample item we created is removed.",
    route: '/dashboard',
  },
  {
    id: 'apps',
    title: 'Connect your tools',
    body: "Everything starts with your tools. In a real setup you'd connect detection sources here — say Microsoft Defender for email and CrowdStrike for endpoints. For the demo we'll pretend those are connected and incidents will start arriving from them on the next step.",
    route: '/onboarding/sources',
  },
  {
    id: 'ingest-webhook',
    title: 'Turn on the ingestion webhook',
    body: 'Most tools forward incidents to Shuffle over a webhook. Click the highlighted Webhook button on the Incidents page and enable it — this gives you a URL detection tools can post to. We need this on before incidents can land.',
    route: '/incidents',
    requirement: {
      label: 'Enable the ingestion webhook',
      targetSelector: '[data-tour="webhook-ingestion-button"]',
    },
  },
  {
    id: 'enable-crowdstrike',
    title: 'Turn on CrowdStrike',
    body: 'Now toggle on the CrowdStrike source so EDR alerts route into Shuffle. Click the highlighted CrowdStrike icon and switch it on.',
    route: '/incidents',
    requirement: {
      label: 'Enable CrowdStrike as an ingestion source',
      targetSelector: '[data-tour="ingestion-source-crowdstrike"]',
    },
  },
  {
    id: 'incidents-list',
    title: 'Incidents arriving',
    body: 'With your tools connected, incidents from Defender and CrowdStrike start showing up. Each row shows severity, the source tool, who it\'s assigned to, and current status. Try opening one.',
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
    title: 'Approve an AI agent action',
    body: "When the AI agent proposes a high-stakes action (like isolating a host), it waits for your approval. Find a pending notification on the dashboard and click Approve — the spotlight will point you at it.",
    route: '/dashboard',
    requirement: {
      label: 'Approve a pending agent action',
      targetSelector: '[data-tour="agent-approve-button"]',
    },
  },
  {
    id: 'wrap',
    title: 'You\'re all set',
    body: 'That\'s the tour. When you\'re ready to use real data, click "Clean up demo data" on the dashboard — we\'ll remove every sample item we created.',
    route: '/dashboard',
  },
];

export type DemoDock = 'right' | 'bottom';

interface DemoContextValue {
  active: boolean;
  isSeeding: boolean;
  isCleaning: boolean;
  drawerOpen: boolean;
  /** When true, the drawer collapses into a small pill in the bottom-right. */
  minimized: boolean;
  /** Where the expanded drawer is docked. */
  dock: DemoDock;
  step: number;
  stats: { incidents: number; assets: number; users: number };
  /** Map of step id → completed (only relevant for steps with a requirement). */
  completedSteps: Record<string, boolean>;
  /** Whether the current step's gate (if any) is satisfied. */
  currentStepUnlocked: boolean;
  startDemo: () => Promise<void>;
  openTour: () => void;
  closeTour: () => void;
  minimizeTour: () => void;
  restoreTour: () => void;
  toggleDock: () => void;
  setDock: (d: DemoDock) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (i: number) => void;
  cleanup: () => Promise<void>;
  /** Imperatively mark a step as done (used by completion watchers). */
  markStepCompleted: (stepId: string) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [active, setActive] = useState(() => isDemoActive());
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem('shuffle_demo_minimized') === 'true'; } catch { return false; }
  });
  const [dock, setDockState] = useState<DemoDock>(() => {
    try {
      const v = localStorage.getItem('shuffle_demo_dock');
      return v === 'bottom' ? 'bottom' : 'right';
    } catch { return 'right'; }
  });
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState(() => getDemoStats());
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // GA dedupe: each step view fires at most once per session, each completion
  // fires at most once per step. Refs survive re-renders without retriggering.
  const viewedStepsRef = useRef<Set<string>>(new Set());
  const completedStepsGARef = useRef<Set<string>>(new Set());

  /** Fire a GA funnel event for a tour step. Safe no-op outside cloud. */
  const trackDemoStep = useCallback((
    event: typeof GA_EVENTS.DEMO_STEP_VIEW | typeof GA_EVENTS.DEMO_STEP_COMPLETE | typeof GA_EVENTS.DEMO_FINISH,
    index: number,
  ) => {
    const def = TOUR_STEPS[index];
    if (!def) return;
    trackPredefinedEvent(event, def.id, index, { step_index: index, step_id: def.id });
  }, []);

  const minimizeTour = useCallback(() => {
    setMinimized(true);
    try { localStorage.setItem('shuffle_demo_minimized', 'true'); } catch { /* ignore */ }
    trackPredefinedEvent(GA_EVENTS.DEMO_MINIMIZE, TOUR_STEPS[step]?.id, step);
  }, [step]);
  const restoreTour = useCallback(() => {
    setMinimized(false);
    setDrawerOpen(true);
    try { localStorage.setItem('shuffle_demo_minimized', 'false'); } catch { /* ignore */ }
    trackPredefinedEvent(GA_EVENTS.DEMO_RESTORE, TOUR_STEPS[step]?.id, step);
  }, [step]);
  const setDock = useCallback((d: DemoDock) => {
    setDockState(d);
    try { localStorage.setItem('shuffle_demo_dock', d); } catch { /* ignore */ }
  }, []);
  const toggleDock = useCallback(() => {
    setDockState(prev => {
      const next: DemoDock = prev === 'right' ? 'bottom' : 'right';
      try { localStorage.setItem('shuffle_demo_dock', next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const refreshStats = useCallback(() => setStats(getDemoStats()), []);

  const markStepCompleted = useCallback((stepId: string) => {
    setCompletedSteps(prev => (prev[stepId] ? prev : { ...prev, [stepId]: true }));
    // Fire DEMO_STEP_COMPLETE once per step (gated steps only — this is invoked
    // by the completion watchers when the real action is detected).
    if (!completedStepsGARef.current.has(stepId)) {
      completedStepsGARef.current.add(stepId);
      const idx = TOUR_STEPS.findIndex(s => s.id === stepId);
      if (idx >= 0) trackDemoStep(GA_EVENTS.DEMO_STEP_COMPLETE, idx);
    }
  }, [trackDemoStep]);

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
      navigateForStep(0);
      await runStepSeed(0);
    } finally {
      setIsSeeding(false);
    }
  }, [navigateForStep, runStepSeed]);

  const openTour = useCallback(() => {
    setDrawerOpen(true);
    setMinimized(false);
    try { localStorage.setItem('shuffle_demo_minimized', 'false'); } catch { /* ignore */ }
    navigateForStep(step);
    runStepSeed(step);
  }, [navigateForStep, runStepSeed, step]);

  const closeTour = useCallback(() => setDrawerOpen(false), []);

  const currentStep = TOUR_STEPS[step];
  const currentStepUnlocked = !currentStep?.requirement || !!completedSteps[currentStep.id];

  const nextStep = useCallback(() => {
    setStep(prev => {
      const cur = TOUR_STEPS[prev];
      // Block forward navigation if requirement not met
      if (cur?.requirement && !completedSteps[cur.id]) return prev;
      const next = Math.min(prev + 1, TOUR_STEPS.length - 1);
      navigateForStep(next);
      runStepSeed(next);
      return next;
    });
  }, [navigateForStep, runStepSeed, completedSteps]);

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
    // Allow free backward jumps; forward jumps respect the gate at current step.
    if (clamped > step) {
      const cur = TOUR_STEPS[step];
      if (cur?.requirement && !completedSteps[cur.id]) return;
    }
    setStep(clamped);
    navigateForStep(clamped);
    runStepSeed(clamped);
  }, [navigateForStep, runStepSeed, completedSteps, step]);

  const cleanup = useCallback(async () => {
    setIsCleaning(true);
    try {
      const res = await cleanupDemoData();
      setActive(false);
      setDrawerOpen(false);
      setStep(0);
      setCompletedSteps({});
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
    active, isSeeding, isCleaning, drawerOpen, minimized, dock, step, stats,
    completedSteps, currentStepUnlocked,
    startDemo, openTour, closeTour, minimizeTour, restoreTour, toggleDock, setDock,
    nextStep, prevStep, goToStep, cleanup,
    markStepCompleted,
  }), [
    active, isSeeding, isCleaning, drawerOpen, minimized, dock, step, stats,
    completedSteps, currentStepUnlocked,
    startDemo, openTour, closeTour, minimizeTour, restoreTour, toggleDock, setDock,
    nextStep, prevStep, goToStep, cleanup,
    markStepCompleted,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextValue => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
};
