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
  source?: string;
  createdTs: number;
}

interface ToolTrendChartProps {
  incidents: Incident[];
  dateFrom?: Date;
  dateTo?: Date;
}

// Distinct colors for up to 8 tools
const TOOL_PALETTE = [
  '#60a5fa', '#f59e0b', '#22c55e', '#a78bfa',
  '#f472b6', '#fb923c', '#2dd4bf', '#e879f9',
];

const buildToolBuckets = (incidents: Incident[], from: Date, to: Date) => {
  const start = startOfDay(from);
  const end = endOfDay(to);

  // Collect all tool names
  const toolSet = new Set<string>();
  const filtered = incidents.filter(inc => {
    if (!inc.createdTs || inc.createdTs < start.getTime() || inc.createdTs > end.getTime() + 86400000) return false;
    const tool = inc.source || 'Unknown';
    toolSet.add(tool);
    return true;
  });

  const tools = Array.from(toolSet).sort();

  // Create day buckets
  const buckets: Record<string, any>[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const bucket: Record<string, any> = {
      date: format(cursor, 'MMM d'),
      dateMs: cursor.getTime(),
    };
    tools.forEach(t => { bucket[t] = 0; });
    buckets.push(bucket);
    cursor = new Date(cursor.getTime() + 86400000);
  }

  // Fill
  for (const inc of filtered) {
    const dayStart = startOfDay(new Date(inc.createdTs)).getTime();
    const bucket = buckets.find(b => b.dateMs === dayStart);
    if (bucket) {
      const tool = inc.source || 'Unknown';
      bucket[tool]++;
    }
  }

  return { buckets, tools };
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

const ToolChartContent = ({ data, tools, height = 120 }: { data: any[]; tools: string[]; height?: number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
      <defs>
        {tools.map((tool, i) => {
          const color = TOOL_PALETTE[i % TOOL_PALETTE.length];
          return (
            <linearGradient key={tool} id={`gradient-tool-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          );
        })}
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
      {tools.map((tool, i) => {
        const color = TOOL_PALETTE[i % TOOL_PALETTE.length];
        return (
          <Area
            key={tool}
            type="monotone"
            dataKey={tool}
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-tool-${i})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: 'hsl(var(--card))' }}
            stackId="tools"
          />
        );
      })}
    </AreaChart>
  </ResponsiveContainer>
);

export const ToolTrendChart = ({ incidents, dateFrom, dateTo }: ToolTrendChartProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const { buckets: data, tools } = useMemo(() => {
    const to = dateTo || new Date();
    const from = dateFrom || subDays(to, 30);
    return buildToolBuckets(incidents, from, to);
  }, [incidents, dateFrom, dateTo]);

  const hasData = tools.length > 0 && data.some(d => tools.some(t => d[t] > 0));

  // Build legend color map
  const toolColors = Object.fromEntries(tools.map((t, i) => [t, TOOL_PALETTE[i % TOOL_PALETTE.length]]));

  return (
    <>
      <Box
        onClick={() => setModalOpen(true)}
        sx={{
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
            Tool Trend
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {tools.slice(0, 5).map(tool => (
              <Box key={tool} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: toolColors[tool] }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>
                  {tool.replace(/_/g, ' ')}
                </Typography>
              </Box>
            ))}
            {tools.length > 5 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))' }}>
                +{tools.length - 5}
              </Typography>
            )}
          </Box>
        </Box>
        {hasData ? (
          <ToolChartContent data={data} tools={tools} height={100} />
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
                Tool Trend
              </Typography>
              <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : format(subDays(new Date(), 30), 'MMM d, yyyy')}
                {' → '}
                {dateTo ? format(dateTo, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {tools.map(tool => (
                  <Box key={tool} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: toolColors[tool] }} />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>
                      {tool.replace(/_/g, ' ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
              </IconButton>
            </Box>
          </Box>
          {hasData ? (
            <ToolChartContent data={data} tools={tools} height={350} />
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
