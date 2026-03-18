import { useMemo, useState } from 'react';
import { Box, Typography, Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
  status: string;
  createdTs: number;
}

interface IncidentTrendChartProps {
  incidents: Incident[];
  dateFrom?: Date;
  dateTo?: Date;
}

interface DayBucket {
  date: string;
  dateMs: number;
  New: number;
  'In Progress': number;
  Resolved: number;
}

const STATUS_COLORS = {
  New: '#60a5fa',
  'In Progress': '#f59e0b',
  Resolved: '#22c55e',
};

const normalizeStatusLabel = (status: string): 'New' | 'In Progress' | 'Resolved' => {
  const s = status.toLowerCase().replace(/[_\s]+/g, '');
  if (s === 'inprogress') return 'In Progress';
  if (s === 'resolved' || s === 'closed') return 'Resolved';
  return 'New';
};

const buildBuckets = (incidents: Incident[], from: Date, to: Date): DayBucket[] => {
  const buckets: DayBucket[] = [];
  const start = startOfDay(from);
  const end = endOfDay(to);

  // Create day buckets
  let cursor = new Date(start);
  while (cursor <= end) {
    buckets.push({
      date: format(cursor, 'MMM d'),
      dateMs: cursor.getTime(),
      New: 0,
      'In Progress': 0,
      Resolved: 0,
    });
    cursor = new Date(cursor.getTime() + 86400000);
  }

  // Fill buckets
  for (const inc of incidents) {
    if (!inc.createdTs || inc.createdTs < start.getTime() || inc.createdTs > end.getTime() + 86400000) continue;
    const dayStart = startOfDay(new Date(inc.createdTs)).getTime();
    const bucket = buckets.find(b => b.dateMs === dayStart);
    if (bucket) {
      const label = normalizeStatusLabel(inc.status);
      bucket[label]++;
    }
  }

  return buckets;
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
      {payload.map((entry: any) => (
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

const ChartContent = ({ data, height = 120 }: { data: DayBucket[]; height?: number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
      <defs>
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <linearGradient key={key} id={`gradient-${key.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
      />
      <YAxis
        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
      />
      <RechartsTooltip content={<CustomTooltip />} />
      {Object.entries(STATUS_COLORS).map(([key, color]) => (
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${key.replace(/\s/g, '')})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: 'hsl(var(--card))' }}
        />
      ))}
    </AreaChart>
  </ResponsiveContainer>
);

export const IncidentTrendChart = ({ incidents, dateFrom, dateTo }: IncidentTrendChartProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const data = useMemo(() => {
    const to = dateTo || new Date();
    const from = dateFrom || subDays(to, 30);
    return buildBuckets(incidents, from, to);
  }, [incidents, dateFrom, dateTo]);

  const hasData = data.some(d => d.New > 0 || d['In Progress'] > 0 || d.Resolved > 0);

  return (
    <>
      <Box
        onClick={() => setModalOpen(true)}
        sx={{
          mt: 2,
          mb: 2,
          px: 1.5,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
          '&:hover': { borderColor: 'rgba(99, 102, 241, 0.4)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Status Trend
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {Object.entries(STATUS_COLORS).map(([label, color]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        {hasData ? (
          <ChartContent data={data} height={100} />
        ) : (
          <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
              No data in range
            </Typography>
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
                Status Trend
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : format(subDays(new Date(), 30), 'MMM d, yyyy')}
                {' → '}
                {dateTo ? format(dateTo, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {Object.entries(STATUS_COLORS).map(([label, color]) => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
              </IconButton>
            </Box>
          </Box>
          {hasData ? (
            <ChartContent data={data} height={350} />
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
