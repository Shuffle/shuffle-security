import { X as CloseIcon } from 'lucide-react';
import { useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, Dialog, DialogContent, IconButton } from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceArea,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface Incident {
  source?: string;
  createdTs: number;
}

interface SourceTrendChartProps {
  incidents: Incident[];
  dateFrom?: Date;
  dateTo?: Date;
  onDateRangeSelect?: (from: Date, to: Date) => void;
}

const SOURCE_PALETTE = [
  '#60a5fa', '#f59e0b', '#22c55e', '#a78bfa',
  '#f472b6', '#fb923c', '#2dd4bf', '#e879f9',
];

const buildSourceBuckets = (incidents: Incident[], from: Date, to: Date) => {
  const start = startOfDay(from);
  const end = endOfDay(to);

  const sourceSet = new Set<string>();
  const filtered = incidents.filter(inc => {
    if (!inc.createdTs || inc.createdTs < start.getTime() || inc.createdTs > end.getTime() + 86400000) return false;
    const source = inc.source || 'Unknown';
    sourceSet.add(source);
    return true;
  });

  const sources = Array.from(sourceSet).sort();

  const buckets: Record<string, any>[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const bucket: Record<string, any> = {
      date: format(cursor, 'MMM d'),
      dateMs: cursor.getTime(),
    };
    sources.forEach(s => { bucket[s] = 0; });
    buckets.push(bucket);
    cursor = new Date(cursor.getTime() + 86400000);
  }

  for (const inc of filtered) {
    const dayStart = startOfDay(new Date(inc.createdTs)).getTime();
    const bucket = buckets.find(b => b.dateMs === dayStart);
    if (bucket) {
      const source = inc.source || 'Unknown';
      bucket[source]++;
    }
  }

  return { buckets, sources };
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

const SourceChartContent = ({ 
  data, sources, height = 120, interactive = false, onDateRangeSelect,
}: { 
  data: any[]; sources: string[]; height?: number; interactive?: boolean;
  onDateRangeSelect?: (from: Date, to: Date) => void;
}) => {
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const selectingRef = useRef(false);

  const handleMouseDown = useCallback((e: any) => {
    if (!interactive || !e?.activeLabel) return;
    selectingRef.current = true;
    setRefAreaLeft(e.activeLabel);
    setRefAreaRight(null);
  }, [interactive]);

  const handleMouseMove = useCallback((e: any) => {
    if (!interactive || !selectingRef.current || !e?.activeLabel) return;
    setRefAreaRight(e.activeLabel);
  }, [interactive]);

  const handleMouseUp = useCallback(() => {
    if (!interactive || !selectingRef.current) return;
    selectingRef.current = false;
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight && onDateRangeSelect) {
      const leftBucket = data.find(d => d.date === refAreaLeft);
      const rightBucket = data.find(d => d.date === refAreaRight);
      if (leftBucket && rightBucket) {
        const fromMs = Math.min(leftBucket.dateMs, rightBucket.dateMs);
        const toMs = Math.max(leftBucket.dateMs, rightBucket.dateMs);
        onDateRangeSelect(new Date(fromMs), endOfDay(new Date(toMs)));
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [interactive, refAreaLeft, refAreaRight, data, onDateRangeSelect]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart 
        data={data} 
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        onMouseDown={interactive ? handleMouseDown : undefined}
        onMouseMove={interactive ? handleMouseMove : undefined}
        onMouseUp={interactive ? handleMouseUp : undefined}
        style={interactive ? { cursor: 'crosshair' } : undefined}
      >
        <defs>
          {sources.map((source, i) => {
            const color = SOURCE_PALETTE[i % SOURCE_PALETTE.length];
            return (
              <linearGradient key={source} id={`gradient-source-${i}`} x1="0" y1="0" x2="0" y2="1">
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
        {sources.map((source, i) => {
          const color = SOURCE_PALETTE[i % SOURCE_PALETTE.length];
          return (
            <Area
              key={source}
              type="monotone"
              dataKey={source}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-source-${i})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: 'hsl(var(--card))' }}
              isAnimationActive={false}
            />
          );
        })}
        {interactive && refAreaLeft && refAreaRight && (
          <ReferenceArea
            x1={refAreaLeft}
            x2={refAreaRight}
            strokeOpacity={0.3}
            fill="hsl(var(--primary))"
            fillOpacity={0.15}
            stroke="hsl(var(--primary))"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const SourceTrendChart = ({ incidents, dateFrom, dateTo, onDateRangeSelect }: SourceTrendChartProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const { buckets: data, sources } = useMemo(() => {
    const to = dateTo || new Date();
    const from = dateFrom || subDays(to, 30);
    return buildSourceBuckets(incidents, from, to);
  }, [incidents, dateFrom, dateTo]);

  const hasData = sources.length > 0 && data.some(d => sources.some(t => d[t] > 0));
  const sourceColors = Object.fromEntries(sources.map((t, i) => [t, SOURCE_PALETTE[i % SOURCE_PALETTE.length]]));

  return (
    <>
      <Box
        onClick={() => setModalOpen(true)}
        sx={{
          mb: 2,
          px: 1.5,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: 'transparent',
          border: '1px solid hsl(var(--border))',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
          '&:hover': { borderColor: 'rgba(99, 102, 241, 0.4)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Source Trend
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {sources.slice(0, 5).map(source => (
              <Box key={source} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: sourceColors[source] }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>
                  {source.replace(/_/g, ' ')}
                </Typography>
              </Box>
            ))}
            {sources.length > 5 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'hsl(var(--muted-foreground))' }}>
                +{sources.length - 5}
              </Typography>
            )}
          </Box>
        </Box>
        {hasData ? (
          <SourceChartContent data={data} sources={sources} height={100} />
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
                Source Trend
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                  {dateFrom ? format(dateFrom, 'MMM d, yyyy') : format(subDays(new Date(), 30), 'MMM d, yyyy')}
                  {' → '}
                  {dateTo ? format(dateTo, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
                </Typography>
                {onDateRangeSelect && (
                  <Typography variant="caption" sx={{ color: 'hsl(var(--primary))', fontSize: '0.65rem', opacity: 0.7 }}>
                    • Click & drag to select range
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {sources.map(source => (
                  <Box key={source} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sourceColors[source] }} />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>
                      {source.replace(/_/g, ' ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <IconButton onClick={() => setModalOpen(false)} size="small">
                <CloseIcon size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
              </IconButton>
            </Box>
          </Box>
          {hasData ? (
            <SourceChartContent 
              data={data} 
              sources={sources} 
              height={350} 
              interactive={!!onDateRangeSelect}
              onDateRangeSelect={(from, to) => {
                onDateRangeSelect?.(from, to);
                setModalOpen(false);
              }}
            />
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
