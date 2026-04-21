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
  /** Short lead sentence — keep it to one line if possible. */
  body: string;
  /** Optional scannable bullet points shown under the body. */
  bullets?: string[];
  route?: string;
  /** If set, Next is disabled until completedSteps[id] is true. */
  requirement?: TourStepRequirement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your demo',
    body: 'Hands-on demo — not a sandbox. Real changes, easy cleanup.',
    bullets: [
      'Enables apps in your account',
      'Seeds sample incidents, assets & users',
      'AI agent runs live actions on your approval',
      '"Clean up demo data" removes everything we added',
    ],
    route: '/dashboard',
  },
  {
    id: 'ingest-webhook',
    title: 'Turn on the ingestion webhook',
    body: 'A webhook URL where tools can post incidents.',
    bullets: [
      'Click the highlighted Webhook button',
      'Enable it to receive incoming alerts',
    ],
    route: '/incidents',
    requirement: {
      label: 'Enable the ingestion webhook',
      targetSelector: '[data-tour="webhook-ingestion-button"]',
    },
  },
  {
    id: 'add-outlook',
    title: 'Add an ingestion source',
    body: 'Pull alerts from a real tool.',
    bullets: [
      'Click the highlighted "+" button',
      'Pick "Outlook Office365" in the popup',
      "We'll pretend-authenticate it for the demo",
    ],
    route: '/incidents',
    requirement: {
      label: 'Add Outlook Office365 as an ingestion source',
      targetSelector: '[data-tour="add-ingestion-source-button"]',
    },
  },
  {
    id: 'apps',
    title: 'Connect your tools',
    body: 'Detection sources feed into Shuffle.',
    bullets: [
      'Microsoft Defender — email alerts',
      'CrowdStrike — endpoint alerts',
      "We'll simulate these for the demo",
    ],
    route: '/onboarding/sources',
  },
  {
    id: 'incidents-list',
    title: 'Incidents arriving',
    body: 'Alerts from your tools land here. Open one to dig in.',
    bullets: [
      'Severity, source tool, assignee, status',
      'Filter, sort, bulk-resolve',
    ],
    route: '/incidents',
  },
  {
    id: 'incident-detail',
    title: 'Inside an incident',
    body: 'Full picture of one incident.',
    bullets: [
      'Description & observables (IPs, hashes, users)',
      'Tasks for the responder',
      'Activity feed including AI agent actions',
    ],
  },
  {
    id: 'assets',
    title: 'Assets',
    body: 'The devices and accounts you protect.',
    bullets: [
      'Laptops, servers, mobile, cloud workloads',
      'Risk score per asset for triage',
    ],
    route: '/assets',
  },
  {
    id: 'vulnerabilities',
    title: 'Vulnerabilities',
    body: 'Scanner findings unified into one view.',
    bullets: [
      'Sources: Qualys, Tenable, Snyk, AWS Config…',
      'Filter by severity, source, or asset',
    ],
    route: '/vulnerabilities',
  },
  {
    id: 'agent',
    title: 'Approve an AI agent action',
    body: 'High-stakes actions wait for you.',
    bullets: [
      'Find a pending notification on the dashboard',
      'Click Approve — the spotlight will point at it',
    ],
    route: '/dashboard',
    requirement: {
      label: 'Approve a pending agent action',
      targetSelector: '[data-tour="agent-approve-button"]',
    },
  },
  {
    id: 'wrap',
    title: 'You\'re all set',
    body: 'That\'s the tour.',
    bullets: [
      'Click "Clean up demo data" on the dashboard when done',
      'Every sample item we added gets removed',
    ],
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
  /** Set a step's completion explicitly — supports reverting (e.g. webhook
   *  re-stopped after being started). */
  setStepCompleted: (stepId: string, done: boolean) => void;
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
      return v === 'right' ? 'right' : 'bottom';
    } catch { return 'bottom'; }
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

  const setStepCompleted = useCallback((stepId: string, done: boolean) => {
    setCompletedSteps(prev => {
      const cur = !!prev[stepId];
      if (cur === done) return prev;
      const next = { ...prev };
      if (done) next[stepId] = true; else delete next[stepId];
      return next;
    });
    // Fire DEMO_STEP_COMPLETE once per step on the first true-flip only.
    if (done && !completedStepsGARef.current.has(stepId)) {
      completedStepsGARef.current.add(stepId);
      const idx = TOUR_STEPS.findIndex(s => s.id === stepId);
      if (idx >= 0) trackDemoStep(GA_EVENTS.DEMO_STEP_COMPLETE, idx);
    }
  }, [trackDemoStep]);

  const markStepCompleted = useCallback((stepId: string) => {
    setStepCompleted(stepId, true);
  }, [setStepCompleted]);

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
      // Reset GA dedupes for a fresh funnel run
      viewedStepsRef.current = new Set();
      completedStepsGARef.current = new Set();
      trackPredefinedEvent(GA_EVENTS.DEMO_START);
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

  // Closing the tour drawer also deactivates demo mode so the dashboard CTA
  // returns to its inactive state. Any already-seeded sample data stays put
  // until the user explicitly runs "Clean up demo data".
  const closeTour = useCallback(() => {
    setDrawerOpen(false);
    setActive(false);
    try { localStorage.removeItem('shuffle_demo_active'); } catch { /* ignore */ }
  }, []);

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
    trackPredefinedEvent(GA_EVENTS.DEMO_CLEANUP, TOUR_STEPS[step]?.id, step);
    try {
      const res = await cleanupDemoData();
      setActive(false);
      setDrawerOpen(false);
      setStep(0);
      setCompletedSteps({});
      viewedStepsRef.current = new Set();
      completedStepsGARef.current = new Set();
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
  }, [refreshStats, step]);

  // Funnel signal: whenever the user lands on a new step (via start/next/prev/
  // goToStep/openTour), fire DEMO_STEP_VIEW exactly once per step per session.
  // Also fire DEMO_FINISH the first time the final "wrap" step is viewed.
  useEffect(() => {
    if (!active || !drawerOpen) return;
    const def = TOUR_STEPS[step];
    if (!def) return;
    if (viewedStepsRef.current.has(def.id)) return;
    viewedStepsRef.current.add(def.id);
    trackDemoStep(GA_EVENTS.DEMO_STEP_VIEW, step);
    if (step === TOUR_STEPS.length - 1) {
      trackDemoStep(GA_EVENTS.DEMO_FINISH, step);
    }
  }, [active, drawerOpen, step, trackDemoStep]);

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
    markStepCompleted, setStepCompleted,
  }), [
    active, isSeeding, isCleaning, drawerOpen, minimized, dock, step, stats,
    completedSteps, currentStepUnlocked,
    startDemo, openTour, closeTour, minimizeTour, restoreTour, toggleDock, setDock,
    nextStep, prevStep, goToStep, cleanup,
    markStepCompleted, setStepCompleted,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextValue => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
};
