/**
 * UsecaseAlluvialDiagram — Alluvial/Sankey-style visualization showing
 * Source tools → Shuffle → Destination tools for a given usecase.
 * Reuses the same icon + status dot pattern from IntegrationStatus.
 */

import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import { SIEM_PATTERNS, CASES_PATTERNS } from '@/lib/ingestionDetection';
import { TOOL_CATEGORIES } from '@/config/usecases';
import shuffleLogo from '@/assets/shuffle-icon.png';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppNode {
  id: string;
  name: string;
  icon: string;
  hasValidAuth: boolean;
  isActiveOnly: boolean;
}

interface UsecaseAlluvialDiagramProps {
  /** Source tool category ID (e.g. 'siem') */
  sourceCategory: string;
  /** Target tool category ID (e.g. 'case_management') */
  targetCategory: string;
}

// ── Pattern matchers ───────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<string, string[]> = {
  siem: SIEM_PATTERNS,
  case_management: CASES_PATTERNS,
  // extend as needed
};

function matchesCategory(appName: string, categoryId: string): boolean {
  const patterns = CATEGORY_PATTERNS[categoryId];
  if (!patterns) return false;
  const lower = appName.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

// ── Status dot color (same logic as IntegrationStatus) ─────────────────────────

function getStatusColor(app: AppNode): string {
  if (app.isActiveOnly) return 'hsl(var(--destructive))';
  return app.hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))';
}

// ── App bubble component ───────────────────────────────────────────────────────

function AppBubble({ app, size = 40 }: { app: AppNode; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Tooltip
      title={
        <Box sx={{ textAlign: 'left', p: 0.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
            {app.name}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: app.hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))' }}>
            {app.hasValidAuth ? 'Authenticated' : app.isActiveOnly ? 'Not authenticated' : 'Inactive'}
          </Typography>
        </Box>
      }
      placement="bottom"
      arrow
    >
      <Box
        component={Link}
        to={`/apps/${encodeURIComponent(app.name)}`}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          transition: 'transform 0.15s ease',
          '&:hover': { transform: 'scale(1.12)' },
        }}
      >
        {app.icon && !imgFailed ? (
          <Box
            component="img"
            src={app.icon}
            alt={app.name}
            onError={() => setImgFailed(true)}
            sx={{
              width: size,
              height: size,
              borderRadius: '50%',
              objectFit: 'contain',
              backgroundColor: 'hsl(var(--muted))',
              p: 0.5,
            }}
          />
        ) : (
          <Avatar
            sx={{
              width: size,
              height: size,
              backgroundColor: 'hsl(var(--muted))',
              fontSize: size * 0.38,
              color: 'hsl(var(--foreground))',
            }}
          >
            {app.name.charAt(0).toUpperCase()}
          </Avatar>
        )}
        {/* Status dot */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: getStatusColor(app),
            border: '2px solid hsl(var(--card))',
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UsecaseAlluvialDiagram({ sourceCategory, targetCategory }: UsecaseAlluvialDiagramProps) {
  const [allApps, setAllApps] = useState<AppNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch authenticated + active apps
  useEffect(() => {
    if (!API_CONFIG.apiKey) { setLoading(false); return; }

    (async () => {
      try {
        const authRes = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        const authNameSet = new Set<string>();
        let nodes: AppNode[] = [];

        if (authRes.ok) {
          const result = await authRes.json();
          const authData: AuthAppEntry[] = result.data || result;
          if (Array.isArray(authData)) {
            const deduped = deduplicateAuthApps(authData);
            nodes = deduped.map(({ app, hasValidAuth, bestImage }) => {
              authNameSet.add(app.name.toLowerCase());
              return {
                id: app.id,
                name: app.name,
                icon: bestImage || app.large_image || '',
                hasValidAuth,
                isActiveOnly: false,
              };
            });
          }
        }

        // Fill with active apps
        try {
          const appsRes = await fetch(getApiUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          });
          if (appsRes.ok) {
            const appsData = await appsRes.json();
            if (Array.isArray(appsData)) {
              for (const app of appsData.filter((a: any) => a.activated)) {
                if (!authNameSet.has((app.name || '').toLowerCase())) {
                  authNameSet.add((app.name || '').toLowerCase());
                  nodes.push({
                    id: app.id || app.name,
                    name: app.name,
                    icon: app.large_image || '',
                    hasValidAuth: false,
                    isActiveOnly: true,
                  });
                }
              }
            }
          }
        } catch (_) {}

        setAllApps(nodes);
      } catch (err) {
        console.error('[AlluvialDiagram] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sourceApps = useMemo(
    () => allApps.filter(a => matchesCategory(a.name, sourceCategory)),
    [allApps, sourceCategory],
  );
  const targetApps = useMemo(
    () => allApps.filter(a => matchesCategory(a.name, targetCategory)),
    [allApps, targetCategory],
  );

  const sourceMeta = TOOL_CATEGORIES.find(c => c.id === sourceCategory);
  const targetMeta = TOOL_CATEGORIES.find(c => c.id === targetCategory);

  // SVG dimensions
  const nodeSize = 40;
  const colWidth = 80;
  const svgPadding = 20;
  const rowGap = 16;

  const maxNodes = Math.max(sourceApps.length, targetApps.length, 1);
  const colHeight = maxNodes * (nodeSize + rowGap) - rowGap;
  const svgHeight = colHeight + svgPadding * 2 + 40; // extra for labels
  const svgWidth = colWidth * 3 + 160; // 3 columns with spacing

  const leftX = svgPadding + nodeSize / 2;
  const centerX = svgWidth / 2;
  const rightX = svgWidth - svgPadding - nodeSize / 2;

  const getY = (idx: number, total: number) => {
    const totalHeight = total * (nodeSize + rowGap) - rowGap;
    const startY = (svgHeight - 30) / 2 - totalHeight / 2 + nodeSize / 2;
    return startY + idx * (nodeSize + rowGap);
  };

  const centerY = (svgHeight - 30) / 2;

  // Curved path from source node to center
  const makePath = (fromX: number, fromY: number, toX: number, toY: number) => {
    const cx1 = fromX + (toX - fromX) * 0.45;
    const cx2 = fromX + (toX - fromX) * 0.55;
    return `M ${fromX} ${fromY} C ${cx1} ${fromY}, ${cx2} ${toY}, ${toX} ${toY}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
          Loading integrations…
        </Typography>
      </Box>
    );
  }

  const hasApps = sourceApps.length > 0 || targetApps.length > 0;

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      {/* SVG alluvial diagram */}
      <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <svg
          width={svgWidth}
          height={svgHeight + 30}
          viewBox={`0 0 ${svgWidth} ${svgHeight + 30}`}
          style={{ overflow: 'visible' }}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="flow-gradient-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="flow-gradient-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Flow paths: source → center */}
          {sourceApps.map((_, i) => {
            const fromY = getY(i, sourceApps.length);
            return (
              <path
                key={`sl-${i}`}
                d={makePath(leftX + nodeSize / 2 + 4, fromY, centerX - 28, centerY)}
                fill="none"
                stroke="url(#flow-gradient-left)"
                strokeWidth={2.5}
                opacity={0.7}
              />
            );
          })}

          {/* Flow paths: center → target */}
          {targetApps.map((_, i) => {
            const toY = getY(i, targetApps.length);
            return (
              <path
                key={`sr-${i}`}
                d={makePath(centerX + 28, centerY, rightX - nodeSize / 2 - 4, toY)}
                fill="none"
                stroke="url(#flow-gradient-right)"
                strokeWidth={2.5}
                opacity={0.7}
              />
            );
          })}

          {/* Animated particles along paths */}
          {sourceApps.map((_, i) => {
            const fromY = getY(i, sourceApps.length);
            const pathD = makePath(leftX + nodeSize / 2 + 4, fromY, centerX - 28, centerY);
            return (
              <g key={`pl-${i}`}>
                <circle r="3" fill="hsl(var(--primary))" opacity="0.6" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}
          {targetApps.map((_, i) => {
            const toY = getY(i, targetApps.length);
            const pathD = makePath(centerX + 28, centerY, rightX - nodeSize / 2 - 4, toY);
            return (
              <g key={`pr-${i}`}>
                <circle r="3" fill="hsl(var(--primary))" opacity="0.6" filter="url(#glow)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}

          {/* Column labels */}
          <text x={leftX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            {sourceMeta?.label || sourceCategory}
          </text>
          <text x={centerX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            Shuffle
          </text>
          <text x={rightX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            {targetMeta?.label || targetCategory}
          </text>
        </svg>

        {/* Overlay HTML app bubbles on top of SVG */}
        <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: svgWidth, height: svgHeight + 30, pointerEvents: 'none' }}>
          {/* Source apps */}
          {sourceApps.map((app, i) => {
            const y = getY(i, sourceApps.length);
            return (
              <Box
                key={app.id}
                sx={{
                  position: 'absolute',
                  left: leftX - nodeSize / 2,
                  top: y - nodeSize / 2,
                  pointerEvents: 'auto',
                }}
              >
                <AppBubble app={app} size={nodeSize} />
              </Box>
            );
          })}

          {/* Center: Shuffle logo */}
          <Box
            sx={{
              position: 'absolute',
              left: centerX - 24,
              top: centerY - 24,
              pointerEvents: 'auto',
            }}
          >
            <Tooltip title="Shuffle Security" placement="bottom" arrow>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
                  boxShadow: '0 4px 20px hsl(var(--primary) / 0.3)',
                }}
              >
                <Box
                  component="img"
                  src={shuffleLogo}
                  alt="Shuffle"
                  sx={{ width: 28, height: 28, objectFit: 'contain', filter: 'brightness(10)' }}
                />
              </Box>
            </Tooltip>
          </Box>

          {/* Target apps */}
          {targetApps.map((app, i) => {
            const y = getY(i, targetApps.length);
            return (
              <Box
                key={app.id}
                sx={{
                  position: 'absolute',
                  left: rightX - nodeSize / 2,
                  top: y - nodeSize / 2,
                  pointerEvents: 'auto',
                }}
              >
                <AppBubble app={app} size={nodeSize} />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Empty state */}
      {!hasApps && (
        <Typography sx={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 2 }}>
          No {sourceMeta?.label} or {targetMeta?.label} tools connected yet.{' '}
          <Box component={Link} to="/onboarding" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
            Connect tools
          </Box>
        </Typography>
      )}
    </Box>
  );
}
