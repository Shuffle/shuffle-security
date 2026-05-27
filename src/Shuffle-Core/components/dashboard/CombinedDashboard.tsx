/**
 * CombinedDashboard — single surface that stacks the security
 * DashboardOverview on top and the AutomationDashboard below.
 *
 * Accepts the same flat host props (`serverside`, `isLoaded`, `isLoggedIn`,
 * `userdata`, `globalUrl`, `theme`) as every other Shuffle-Core surface, plus
 * any optional data/control props from either inner dashboard. Host props are
 * forwarded to both dashboards; data props default to empty so a host can
 * mount this with just the standard context object.
 */
import { Box } from '@mui/material';
import DashboardOverview, { type OverviewProps } from './DashboardOverview';
import AutomationDashboard, { type AutomationDashboardProps } from './AutomationDashboard';
import type { ShuffleCoreHostProps } from '../../types/host-props';

export interface CombinedDashboardProps
  extends ShuffleCoreHostProps,
    Partial<Omit<OverviewProps, keyof ShuffleCoreHostProps | 'days'>>,
    Partial<Omit<AutomationDashboardProps, keyof ShuffleCoreHostProps | 'gran' | 'customRange' | 'onRangeSelect' | 'days'>> {
  /** Gap (in MUI spacing units) between the two dashboards. Defaults to 4. */
  gap?: number;
  /** Time range — number (overview days) or string (automation days). */
  days?: number | string;
}

const EMPTY_VULNS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

const CombinedDashboard = ({
  gap = 4,
  // Overview data (defaulted so the component is safe with only host props)
  incidents,
  incidentsLoading,
  vulnSeverityCounts,
  vulnLoading,
  monitorHostCount = null,
  runningSensorCount = null,
  monitorsLoading,
  days,
  gran,
  customRange,
  onRangeSelect,
  // Automation-specific
  orgId,
  displayName,
  headerLeft,
  onDaysChange,
  onGranChange,
  mode,
  onModeChange,
  refreshKey,
  hideRefresh,
  // Host props — forwarded to both
  ...host
}: CombinedDashboardProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap }}>
    <DashboardOverview
      {...host}
      incidents={incidents ?? []}
      incidentsLoading={incidentsLoading}
      vulnSeverityCounts={vulnSeverityCounts ?? EMPTY_VULNS}
      vulnLoading={vulnLoading}
      monitorHostCount={monitorHostCount}
      runningSensorCount={runningSensorCount}
      monitorsLoading={monitorsLoading}
      days={typeof days === 'number' ? days : undefined}
      gran={gran}
      customRange={customRange}
      onRangeSelect={onRangeSelect}
    />
    <AutomationDashboard
      {...host}
      orgId={orgId}
      displayName={displayName}
      headerLeft={headerLeft}
      days={typeof days === 'string' ? days : undefined}
      onDaysChange={onDaysChange}
      gran={gran}
      onGranChange={onGranChange}
      mode={mode}
      onModeChange={onModeChange}
      refreshKey={refreshKey}
      hideRefresh={hideRefresh}
      customRange={customRange}
      onRangeSelect={onRangeSelect}
    />
  </Box>
);

export default CombinedDashboard;
