/**
 * ScheduleHealthBanner — surfaces on-call schedule problems on /incidents
 * and /users so issues like coverage gaps or dead-end escalations are
 * visible exactly where responders work.
 *
 * Reads the `assignment_schedules` config datastore item and runs the shared
 * `analyzeSchedules` analyzer. Renders nothing when the config is healthy.
 */

import { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box, Button, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getDatastoreItem, DATASTORE_CATEGORIES } from '@/services/datastore';
import {
  analyzeSchedules,
  highestSeverity,
  type ScheduleIssue,
} from '@/lib/scheduleHealth';
import type { AssignmentConfig, UserSchedule } from '@/components/users/OnCallScheduleManager';

interface ScheduleHealthBannerProps {
  /** Override the default destination for the "Manage schedules" CTA. */
  manageHref?: string;
  /** Hide the CTA entirely (e.g. when already rendered on /users). */
  hideManageCta?: boolean;
  /** Compact spacing for use inside denser pages like /incidents. */
  compact?: boolean;
}

const SEVERITY_LABEL = {
  critical: 'On-call schedule issues need attention',
  warning: 'On-call schedule could be improved',
  info: 'On-call schedule notes',
} as const;

export const ScheduleHealthBanner = ({
  manageHref = '/users',
  hideManageCta = false,
  compact = false,
}: ScheduleHealthBannerProps) => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<ScheduleIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getDatastoreItem(
          'assignment_schedules',
          DATASTORE_CATEGORIES.CONFIGURATION,
        );
        let schedules: UserSchedule[] = [];
        if (response.success && response.item?.value) {
          const data: AssignmentConfig = typeof response.item.value === 'string'
            ? JSON.parse(response.item.value)
            : response.item.value;
          schedules = data.userSchedules || [];
        }
        if (!cancelled) setIssues(analyzeSchedules(schedules));
      } catch {
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || issues.length === 0) return null;

  const top = highestSeverity(issues);
  if (!top) return null;

  const severity: 'error' | 'warning' | 'info' =
    top === 'critical' ? 'error' : top === 'warning' ? 'warning' : 'info';

  return (
    <Box sx={{ mb: compact ? 2 : 3 }}>
      <Alert
        severity={severity}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: severity === 'error'
            ? 'hsl(var(--destructive) / 0.4)'
            : severity === 'warning'
              ? 'hsl(38 92% 50% / 0.4)'
              : 'hsl(var(--primary) / 0.4)',
          bgcolor: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          '& .MuiAlert-icon': {
            color: severity === 'error'
              ? 'hsl(var(--destructive))'
              : severity === 'warning'
                ? 'hsl(38 92% 50%)'
                : 'hsl(var(--primary))',
          },
        }}
        action={
          <Stack direction="row" spacing={0.5} alignItems="center">
            {!hideManageCta && (
              <Button
                size="small"
                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                onClick={() => navigate(manageHref)}
                sx={{
                  color: 'hsl(var(--foreground))',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'hsl(var(--muted) / 0.4)' },
                }}
              >
                Manage schedules
              </Button>
            )}
            <IconButton
              size="small"
              onClick={() => setExpanded(v => !v)}
              sx={{
                color: 'hsl(var(--muted-foreground))',
                transition: 'transform 0.2s',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 0.25 }}>
          {SEVERITY_LABEL[top]} ({issues.length})
        </AlertTitle>
        <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          {issues[0].title}
        </Typography>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {issues.map(issue => (
              <Box
                key={issue.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--muted) / 0.3)',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', mb: 0.25 }}
                >
                  {issue.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  {issue.detail}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Collapse>
      </Alert>
    </Box>
  );
};

export default ScheduleHealthBanner;
