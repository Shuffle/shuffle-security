/**
 * CombinedDashboard — single surface that stacks the security
 * DashboardOverview on top and the AutomationDashboard below.
 *
 * Use this when a host wants the full picture (incidents + monitors +
 * vulns + workflow/app automation stats) in one component instead of
 * mounting the two dashboards separately.
 *
 * All props of both dashboards are forwarded via `overview` / `automation`.
 */
import { Box } from '@mui/material';
import DashboardOverview, { type OverviewProps } from './DashboardOverview';
import AutomationDashboard, { type AutomationDashboardProps } from './AutomationDashboard';

export interface CombinedDashboardProps {
  overview: OverviewProps;
  automation: AutomationDashboardProps;
  /** Gap (in MUI spacing units) between the two dashboards. Defaults to 4. */
  gap?: number;
}

const CombinedDashboard = ({ overview, automation, gap = 4 }: CombinedDashboardProps) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap }}>
    <DashboardOverview {...overview} />
    <AutomationDashboard {...automation} />
  </Box>
);

export default CombinedDashboard;
