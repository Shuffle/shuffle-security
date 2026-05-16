import { X as CloseIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Box, Typography, Dialog, DialogContent, IconButton } from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface Incident {
  createdTs: number;
  orgId?: string;
  orgName?: string;
}

interface OrgTrendChartProps {
  incidents: Incident[];
  dateFrom?: Date;
  dateTo?: Date;
}

// Distinct palette for orgs
const ORG_PALETTE = [
  '#a78bfa', '#60a5fa', '#f59e0b', '#34d399', '#f87171',
  '#38bdf8', '#fb923c', '#c084fc', '#4ade80', '#fbbf24',
];

const buildOrgBuckets = (incidents: Incident[], from: Date, to: Date) => {
  const start = startOfDay(from);
  const end = endOfDay(to);

  // Discover orgs
  const orgSet = new Map<string, string>(); // orgId -> orgName
  for (const inc of incidents) {
    if (inc.orgId && !orgSet.has(inc.orgId)) {
      orgSet.set(inc.orgId, inc.orgName || inc.orgId.slice(0, 8));
    }
  }
  const orgIds = Array.from(orgSet.keys());
  const orgNames = Object.fromEntries(orgSet);

  // Create day buckets
  const buckets: Record<string, any>[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const bucket: Record<string, any> = {
      date: format(cursor, 'MMM d'),
      dateMs: cursor.getTime(),
    };
    for (const id of orgIds) bucket[orgNames[id]] = 0;
    buckets.push(bucket);
    cursor = new Date(cursor.getTime() + 86400000);
  }

  // Fill
  for (const inc of incidents) {
    if (!inc.createdTs || !inc.orgId || inc.createdTs < start.getTime() || inc.createdTs > end.getTime() + 86400000) continue;
    const dayStart = startOfDay(new Date(inc.createdTs)).getTime();
    const bucket = buckets.find(b => b.dateMs === dayStart);
    if (bucket) {
      const name = orgNames[inc.orgId];
      if (name) bucket[name]++;
    }
  }

  return { buckets, orgNames: Object.values(orgNames) };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 1.5,
      px: 1.5,
      py: 1,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.filter((e: any) => e.value > 0).map((entry: any) => (
        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'hsl(var(--foreground))', fontSize: '0.7rem' }}>
            {entry.name}: <strong>{entry.value}</strong>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export const OrgTrendChart = ({ incidents, dateFrom, dateTo }: OrgTrendChartProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const { buckets, orgNames } = useMemo(() => {
    const to = dateTo || new Date();
    const from = dateFrom || subDays(to, 30);
    return buildOrgBuckets(incidents, from, to);
  }, [incidents, dateFrom, dateTo]);

  const hasData = buckets.some(b => orgNames.some(n => b[n] > 0));

  const ChartContent = ({ height = 100 }: { height?: number }) => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={buckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          {orgNames.map((name, i) => (
            <linearGradient key={name} id={`org-gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ORG_PALETTE[i % ORG_PALETTE.length]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ORG_PALETTE[i % ORG_PALETTE.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <RechartsTooltip content={<CustomTooltip />} />
        {orgNames.map((name, i) => (
          <Area
            key={name}
            type="monotone"
            dataKey={name}
            stroke={ORG_PALETTE[i % ORG_PALETTE.length]}
            strokeWidth={2}
            fill={`url(#org-gradient-${i})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: ORG_PALETTE[i % ORG_PALETTE.length], fill: 'hsl(var(--card))' }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <Box
        onClick={() => setModalOpen(true)}
        sx={{
          mt: 1,
          mb: 2,
          px: 1.5,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
          '&:hover': { borderColor: 'rgba(167, 139, 250, 0.4)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            By Tenant
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {orgNames.slice(0, 4).map((name, i) => (
              <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ORG_PALETTE[i % ORG_PALETTE.length] }} />
                <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'hsl(var(--muted-foreground))', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </Typography>
              </Box>
            ))}
            {orgNames.length > 4 && (
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'hsl(var(--muted-foreground))' }}>
                +{orgNames.length - 4}
              </Typography>
            )}
          </Box>
        </Box>
        {hasData ? (
          <ChartContent height={100} />
        ) : (
          <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>No data in range</Typography>
          </Box>
        )}
      </Box>

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 3,
              backgroundImage: 'none',
            },
          },
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                Incidents by Tenant
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : format(subDays(new Date(), 30), 'MMM d, yyyy')}
                {' → '}
                {dateTo ? format(dateTo, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {orgNames.map((name, i) => (
                  <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ORG_PALETTE[i % ORG_PALETTE.length] }} />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{name}</Typography>
                  </Box>
                ))}
              </Box>
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
              </IconButton>
            </Box>
          </Box>
          {hasData ? (
            <ChartContent height={350} />
          ) : (
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>No data in range</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
