/**
 * Schedule health analyzer for the Assign & Escalate cache.
 *
 * Surfaces actionable issues with the on-call rotation so analysts on
 * /incidents and admins on /users see the same problems immediately —
 *   • coverage gaps (hours where no human is on-call)
 *   • dead-end escalations (tier with no escalation target above it)
 *   • orphaned tiers (a higher tier is staffed but the tier below is not)
 *   • disabled-only schedules
 *
 * Designed to be cheap & deterministic so it can run on every render.
 */

import type { UserSchedule, EscalationLevel } from '@/components/users/OnCallScheduleManager';

export type ScheduleIssueSeverity = 'critical' | 'warning' | 'info';

export interface ScheduleIssue {
  id: string;
  severity: ScheduleIssueSeverity;
  title: string;
  detail: string;
}

const TIER_ORDER: EscalationLevel[] = ['tier1', 'tier2', 'tier3', 'manager'];
const TIER_LABEL: Record<EscalationLevel, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  manager: 'Manager',
};

/** Total minutes per week covered by a single schedule entry. */
const minutesCovered = (startTime: string, endTime: string, days: number[]): number => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const dailyMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  return dailyMinutes * (days?.length || 0);
};

const WEEK_MINUTES = 7 * 24 * 60;

export const analyzeSchedules = (schedules: UserSchedule[]): ScheduleIssue[] => {
  const issues: ScheduleIssue[] = [];

  // ── No schedules at all ────────────────────────────────────────────────────
  if (!schedules || schedules.length === 0) {
    issues.push({
      id: 'no-schedules',
      severity: 'warning',
      title: 'No on-call schedules configured',
      detail: 'The AI Agent will handle every incoming Tier 1 incident until a human rotation is set up.',
    });
    return issues;
  }

  const enabled = schedules.filter(s => s.enabled);

  if (enabled.length === 0) {
    issues.push({
      id: 'all-disabled',
      severity: 'warning',
      title: 'All on-call rotations are disabled',
      detail: 'Re-enable at least one user so incidents can be auto-assigned to a human.',
    });
    return issues;
  }

  // ── Tier coverage analysis ────────────────────────────────────────────────
  const coveragePerTier: Record<EscalationLevel, number> = {
    tier1: 0, tier2: 0, tier3: 0, manager: 0,
  };
  const usersPerTier: Record<EscalationLevel, number> = {
    tier1: 0, tier2: 0, tier3: 0, manager: 0,
  };

  for (const s of enabled) {
    usersPerTier[s.escalationLevel] += 1;
    for (const entry of s.schedules) {
      coveragePerTier[s.escalationLevel] += minutesCovered(
        entry.startTime, entry.endTime, entry.daysOfWeek,
      );
    }
  }

  // Orphaned higher tiers (e.g. Tier 3 staffed but no Tier 2)
  for (let i = 1; i < TIER_ORDER.length; i++) {
    const above = TIER_ORDER[i];
    const below = TIER_ORDER[i - 1];
    if (usersPerTier[above] > 0 && usersPerTier[below] === 0) {
      issues.push({
        id: `orphan-${above}`,
        severity: 'warning',
        title: `${TIER_LABEL[above]} is staffed but ${TIER_LABEL[below]} is empty`,
        detail: `Incidents will jump straight to ${TIER_LABEL[above]} because no one covers ${TIER_LABEL[below]}.`,
      });
    }
  }

  // Tier 1 coverage gap (anything less than ~80% of the week)
  const tier1Coverage = coveragePerTier.tier1;
  if (usersPerTier.tier1 > 0 && tier1Coverage < WEEK_MINUTES * 0.8) {
    const pct = Math.round((tier1Coverage / WEEK_MINUTES) * 100);
    issues.push({
      id: 'tier1-gap',
      severity: 'warning',
      title: `Tier 1 only covers ~${pct}% of the week`,
      detail: 'The AI Agent will pick up everything else. Add more availability windows to reduce AI fallback hours.',
    });
  }

  // Top of chain has no escalation target — Manager tier empty
  if (usersPerTier.manager === 0 && (usersPerTier.tier3 > 0 || usersPerTier.tier2 > 0)) {
    issues.push({
      id: 'no-manager',
      severity: 'critical',
      title: 'No Manager escalation target',
      detail: 'Critical incidents that escalate past Tier 3 have nowhere to go. Add at least one Manager.',
    });
  }

  // AI cannot escalate anywhere — only Tier 1 staffed and no human above
  const hasAnyHigherTier = usersPerTier.tier2 + usersPerTier.tier3 + usersPerTier.manager > 0;
  if (!hasAnyHigherTier) {
    issues.push({
      id: 'no-escalation-path',
      severity: 'critical',
      title: 'AI Agent has no one to escalate to',
      detail: 'No humans are configured above Tier 1, so unresolved incidents cannot be escalated.',
    });
  }

  return issues;
};

export const highestSeverity = (issues: ScheduleIssue[]): ScheduleIssueSeverity | null => {
  if (issues.some(i => i.severity === 'critical')) return 'critical';
  if (issues.some(i => i.severity === 'warning')) return 'warning';
  if (issues.some(i => i.severity === 'info')) return 'info';
  return null;
};
