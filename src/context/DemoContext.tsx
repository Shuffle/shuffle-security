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
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { seedForStep, cleanupDemoData, isDemoActive, getDemoStats, forceRecreateDemoIncidents, forceCreateSingleDemoIncident, countDemoIncidents } from '@/services/demoMode';
import { enableLiveDemoEnvironment } from '@/services/demoLiveEnvironment';
import { trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';

export interface TourStepRequirement {
  /** Short human label shown in the drawer (e.g. "Enable the ingestion webhook"). */
  label: string;
  /** CSS selector for the element the spotlight should point at. Use a stable `[data-tour="..."]` attr. */
  targetSelector: string;
}

/**
 * A sub-goal is one of several discrete things the user must complete inside
 * a single tour step. Each sub-goal tracks completion under its own id (which
 * is stored in the same `completedSteps` map). The step is unlocked only when
 * every sub-goal id is marked complete.
 */
export interface TourStepSubGoal {
  /** Stable id used as the key in `completedSteps`. */
  id: string;
  /** Short human label shown in the drawer. */
  label: string;
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
  /** If set, Next is disabled until every sub-goal id is in completedSteps. */
  subGoals?: TourStepSubGoal[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your demo',
    body: 'Here is what we will do, in order:',
    bullets: [
      '1. Add ingestion sources (Outlook Office365 + Microsoft 365 Defender)',
      '2. Turn on the ingestion webhook',
      '3. Watch incidents arrive and open one',
      '4. Explore assets and vulnerabilities',
      '5. Approve a live AI agent action',
      '6. Clean up — removes everything we added',
    ],
    route: '/dashboard',
  },
  {
    id: 'add-outlook',
    title: 'Add ingestion sources',
    body: 'Pull alerts from real tools.',
    bullets: [
      'Click the highlighted "+" button',
      'Add "Outlook Office365" — we will pretend-authenticate it',
      'Click "+" again and add "Microsoft 365 Defender"',
    ],
    route: '/incidents',
    requirement: {
      label: 'Add both Outlook Office365 and Microsoft 365 Defender',
      targetSelector: '[data-tour="add-ingestion-source-button"]',
    },
    subGoals: [
      { id: 'add-outlook:outlook', label: 'Add Outlook Office365' },
      { id: 'add-outlook:defender', label: 'Add Microsoft 365 Defender' },
    ],
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
    id: 'incidents-list',
    title: 'Incidents arriving',
    body: 'The phishing email reported by Diego Ruiz just landed. Open it to start investigating — the rest of the related alerts will arrive while you dig in.',
    bullets: [
      'Severity, source tool, assignee, status',
      'Filter, sort, bulk-resolve',
    ],
    route: '/incidents',
    requirement: {
      label: 'The "Phishing email" incident must be present',
      targetSelector: '[data-tour="demo-force-create-incidents"]',
    },
    subGoals: [
      { id: 'incidents-list:present', label: 'The "Phishing email" incident must be present' },
      { id: 'incidents-list:open', label: 'Click the "Phishing email reported by Diego Ruiz" row to open it' },
    ],
  },
  {
    id: 'incident-detail',
    title: 'Watch the agent work',
    body: 'The Activity feed is where the AI agent narrates what it is doing — enrichments, lookups, proposed actions and approvals.',
    bullets: [
      'Every agent step is logged in real time on the right',
      'Filter by Agent to focus on its decisions',
      'Manual comments and revisions show up here too',
    ],
    requirement: {
      label: 'Open the Activity feed on the right',
      targetSelector: '[data-tour="incident-activity-feed"]',
    },
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
    title: 'You are all set',
    body: 'That is demo mode.',
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
  /** Force delete + recreate the demo incidents (manual rescue button). */
  forceCreateIncidents: () => Promise<void>;
  /** True while a force-create is running. */
  isForceCreatingIncidents: boolean;
  /** Force-generate a single "focus" demo incident (Wazuh / Sliver C2).
   *  Other incidents arrive later for cross-correlation. */
  forceGenerateSingleIncident: () => Promise<void>;
  /** True while the single-incident force-generate is running. */
  isForceGeneratingSingle: boolean;
  /** True when at least one demo incident is present in the datastore. */
  hasDemoIncidents: boolean;
  /** True when the user is currently on an incident-detail route. Live. */
  isOnIncidentDetail: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const DemoProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Real-time route check: are we currently on an incident-detail page?
  // Used to gate the `incidents-list:open` sub-goal so the gate flips back
  // off if the user navigates away from the detail page.
  const isOnIncidentDetail = /^\/(?:incidents|alerts|tickets|jobs)\/[^/]+/.test(location.pathname);
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
  const [isForceCreatingIncidents, setIsForceCreatingIncidents] = useState(false);
  const [isForceGeneratingSingle, setIsForceGeneratingSingle] = useState(false);
  const [hasDemoIncidents, setHasDemoIncidents] = useState(false);

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
      // Always force the tour open in its full size when starting — never inherit
      // a stale "minimized" state from a previous session.
      setMinimized(false);
      try { localStorage.setItem('shuffle_demo_minimized', 'false'); } catch { /* ignore */ }
      // Reset GA dedupes for a fresh funnel run
      viewedStepsRef.current = new Set();
      completedStepsGARef.current = new Set();
      trackPredefinedEvent(GA_EVENTS.DEMO_START);
      navigateForStep(0);
      // Make the environment "live": generate ingest + threat-intel
      // workflows and seed Threat Feeds + IOC Types defaults. Runs in
      // parallel with the first-step seeder so it does not block the UI.
      const liveEnvStartedAt = Date.now();
      const liveEnvPromise = enableLiveDemoEnvironment()
        .then(() => {
          trackPredefinedEvent(GA_EVENTS.DEMO_LIVE_ENV_SUCCESS, undefined, Date.now() - liveEnvStartedAt);
        })
        .catch(err => {
          console.warn('[demo] live environment bootstrap failed', err);
          trackPredefinedEvent(GA_EVENTS.DEMO_LIVE_ENV_FAILURE, String(err?.message || 'unknown'), Date.now() - liveEnvStartedAt);
        });
      await Promise.all([runStepSeed(0), liveEnvPromise]);
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
    // Fire the abandon event ONLY if the user did not actually finish the
    // tour. Reaching the wrap step means they completed it.
    const isOnFinalStep = step === TOUR_STEPS.length - 1;
    if (!isOnFinalStep) {
      trackPredefinedEvent(GA_EVENTS.DEMO_ABANDON, TOUR_STEPS[step]?.id, step, {
        step_index: step,
        step_id: TOUR_STEPS[step]?.id,
      });
    }
    setDrawerOpen(false);
    setActive(false);
    try { localStorage.removeItem('shuffle_demo_active'); } catch { /* ignore */ }
  }, [step]);

  const isStepUnlocked = useCallback((s: TourStep | undefined): boolean => {
    if (!s) return true;
    // Sub-goal gate takes precedence: if defined, the step's own
    // `requirement` is purely cosmetic and only the sub-goals decide.
    if (s.subGoals && s.subGoals.length > 0) {
      return s.subGoals.every(g => {
        // Special-case the incidents-list:present sub-goal — it is satisfied
        // by the live datastore presence check, not by the completedSteps map.
        if (g.id === 'incidents-list:present') return hasDemoIncidents;
        // Special-case the incidents-list:open sub-goal — it tracks the live
        // route, so leaving the detail page reverts the gate.
        if (g.id === 'incidents-list:open') return isOnIncidentDetail;
        return !!completedSteps[g.id];
      });
    }
    // Step-level requirement gate (legacy single-goal).
    if (s.requirement && !completedSteps[s.id]) return false;
    return true;
  }, [completedSteps, hasDemoIncidents, isOnIncidentDetail]);

  const currentStep = TOUR_STEPS[step];
  const currentStepUnlocked = isStepUnlocked(currentStep);

  const nextStep = useCallback(() => {
    setStep(prev => {
      const cur = TOUR_STEPS[prev];
      if (!isStepUnlocked(cur)) return prev;
      const next = Math.min(prev + 1, TOUR_STEPS.length - 1);
      // Successful step advance — counts as "user completed step N successfully".
      trackPredefinedEvent(GA_EVENTS.DEMO_STEP_ADVANCE, cur?.id, prev, {
        step_index: prev,
        step_id: cur?.id,
        from_index: prev,
        to_index: next,
      });
      navigateForStep(next);
      runStepSeed(next);
      return next;
    });
  }, [navigateForStep, runStepSeed, isStepUnlocked]);

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
      if (!isStepUnlocked(cur)) return;
    }
    setStep(clamped);
    navigateForStep(clamped);
    runStepSeed(clamped);
  }, [navigateForStep, runStepSeed, isStepUnlocked, step]);

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

  const forceCreateIncidents = useCallback(async () => {
    setIsForceCreatingIncidents(true);
    try {
      const added = await forceRecreateDemoIncidents();
      refreshStats();
      const present = await countDemoIncidents();
      setHasDemoIncidents(present > 0);
      trackPredefinedEvent(GA_EVENTS.DEMO_FORCE_CREATE_INCIDENTS, present > 0 ? 'success' : 'failure', present, {
        added,
        present,
      });
      if (added > 0) {
        toast.success(`Recreated ${added} demo incident${added === 1 ? '' : 's'}.`);
      } else if (present > 0) {
        toast.success(`Demo incidents are present (${present}).`);
      } else {
        toast.error('Could not create demo incidents. Please try again.');
      }
    } catch (err) {
      trackPredefinedEvent(GA_EVENTS.DEMO_FORCE_CREATE_INCIDENTS, 'error', 0, {
        error: String((err as Error)?.message || 'unknown'),
      });
      toast.error('Failed to recreate demo incidents.');
    } finally {
      setIsForceCreatingIncidents(false);
    }
  }, [refreshStats]);

  const forceGenerateSingleIncident = useCallback(async () => {
    setIsForceGeneratingSingle(true);
    try {
      const added = await forceCreateSingleDemoIncident();
      refreshStats();
      const present = await countDemoIncidents();
      setHasDemoIncidents(present > 0);
      trackPredefinedEvent(GA_EVENTS.DEMO_FORCE_CREATE_INCIDENTS, added > 0 ? 'success-single' : 'failure-single', present, {
        added,
        present,
        mode: 'single',
      });
      if (added > 0) {
        toast.success('Generated focus incident — others will follow.');
      } else {
        toast.error('Could not generate the focus incident. Please try again.');
      }
    } catch (err) {
      trackPredefinedEvent(GA_EVENTS.DEMO_FORCE_CREATE_INCIDENTS, 'error-single', 0, {
        error: String((err as Error)?.message || 'unknown'),
        mode: 'single',
      });
      toast.error('Failed to generate the focus incident.');
    } finally {
      setIsForceGeneratingSingle(false);
    }
  }, [refreshStats]);
  // incidents-list step gate flips automatically as soon as data lands. Also
  // re-checks on the demo:refresh broadcast that the seeder fires.
  useEffect(() => {
    if (!active) {
      setHasDemoIncidents(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const n = await countDemoIncidents();
      if (!cancelled) setHasDemoIncidents(n > 0);
    };
    check();
    const interval = window.setInterval(check, 4000);
    const onRefresh = () => check();
    window.addEventListener('demo:refresh', onRefresh as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('demo:refresh', onRefresh as EventListener);
    };
  }, [active]);

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
    forceCreateIncidents, isForceCreatingIncidents,
    forceGenerateSingleIncident, isForceGeneratingSingle,
    hasDemoIncidents,
  }), [
    active, isSeeding, isCleaning, drawerOpen, minimized, dock, step, stats,
    completedSteps, currentStepUnlocked,
    startDemo, openTour, closeTour, minimizeTour, restoreTour, toggleDock, setDock,
    nextStep, prevStep, goToStep, cleanup,
    markStepCompleted, setStepCompleted,
    forceCreateIncidents, isForceCreatingIncidents,
    forceGenerateSingleIncident, isForceGeneratingSingle,
    hasDemoIncidents,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextValue => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
};
