/**
 * UsecaseAlluvialDiagram — Alluvial/Sankey-style visualization showing
 * Source tools → Shuffle → Destination tools for a given usecase.
 *
 * For ingest usecases (SIEM→Ticket, EDR→Ticket, Phishing→Ticket), sources
 * are all apps enabled in the "Ingest Tickets" workflow, with the apps
 * matching the usecase's source category visually highlighted (ring glow).
 */

import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Avatar, Tooltip, IconButton } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AppSearchDrawer from '@/components/shared/AppSearchDrawer';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import {
  SIEM_PATTERNS,
  CASES_PATTERNS,
  EDR_PATTERNS,
  EMAIL_APP_PATTERNS,
  findIngestTicketsWorkflow,
  findForwardTicketsWorkflow,
  extractWorkflowAppNames,
  normalizeAppName,
} from '@/lib/ingestionDetection';
import { TOOL_CATEGORIES } from '@/config/usecases';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AppNode {
  id: string;
  name: string;
  icon: string;
  hasValidAuth: boolean;
  isActiveOnly: boolean;
  /** Whether this app matches the highlighted source category */
  isHighlighted?: boolean;
}

interface UsecaseAlluvialDiagramProps {
  /** Source tool category ID (e.g. 'siem') */
  sourceCategory: string;
  /** Target tool category ID (e.g. 'case_management') */
  targetCategory: string;
  /**
   * If set, source apps are ALL apps in the Ingest Tickets workflow,
   * and apps matching this category get a visual highlight.
   */
  highlightCategory?: string;
}

// ── Pattern matchers ───────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<string, string[]> = {
  siem: SIEM_PATTERNS,
  case_management: CASES_PATTERNS,
  edr: EDR_PATTERNS,
  email: EMAIL_APP_PATTERNS,
};

function matchesCategory(appName: string, categoryId: string): boolean {
  if (isShuffleInternalApp(appName)) return false;
  const patterns = CATEGORY_PATTERNS[categoryId];
  if (!patterns) return false;
  const lower = appName.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/** Filter out Shuffle's own internal tools (e.g. "Shuffle Tools", "Shuffle Datastore") */
const SHUFFLE_INTERNAL_PATTERNS = ['shuffle tools', 'shuffle datastore', 'shuffle workflow'];
function isShuffleInternalApp(appName: string): boolean {
  const lower = appName.toLowerCase();
  return SHUFFLE_INTERNAL_PATTERNS.some(p => lower.includes(p));
}

// ── Sample apps for unauthenticated visitors ────────────────────────────────

const SAMPLE_APPS: Record<string, { name: string; icon: string }[]> = {
  siem: [
    { name: 'Splunk', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Splunk_1995363ec370368ed05a2882ec0ea8fc.png' },
    { name: 'Elasticsearch', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Elasticsearch_971706758e274c2e4083f2621fb5a6f7.png' },
    { name: 'Wazuh', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Wazuh_fb715a176a192620c25d49ba119e94e5.png' },
  ],
  edr: [
    { name: 'SentinelOne', icon: 'https://storage.googleapis.com/shuffle_public/app_images/SentinelOne_0373ed696a3a2cba0a2b6838068f2b80.png' },
    { name: 'Microsoft Defender', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Microsoft_365_Defender_29c926c37334c191666f6470caa05e1c.png' },
    { name: 'Carbon Black', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Carbon_Black_Response_e9fa2602ea6baafffa4b5eec722095d3.png' },
  ],
  email: [
    { name: 'Gmail', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Gmail_794e51c3c1a8b24b89ccc573a3defc47.png' },
    { name: 'Outlook', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Outlook_Office365_accdaaf2eeba6a6ed43b2efc0112032d.png' },
  ],
  case_management: [
    { name: 'Jira', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Jira_eb0c5e572e14ac1140a8355ba93c0d76.png' },
    { name: 'ServiceNow', icon: 'https://storage.googleapis.com/shuffle_public/app_images/Servicenow_b9c2feaf99b6309dabaeaa8518c61d3d.png' },
    { name: 'TheHive', icon: 'https://storage.googleapis.com/shuffle_public/app_images/TheHive_7b0b20f198b28bcd6e7e3d2e7c1d84af.png' },
  ],
};

function getSampleApps(categoryId: string): AppNode[] {
  const samples = SAMPLE_APPS[categoryId] || [];
  return samples.map(s => ({
    id: `sample-${s.name}`,
    name: s.name,
    icon: s.icon,
    hasValidAuth: false,
    isActiveOnly: false,
  }));
}

// ── Status dot color ───────────────────────────────────────────────────────────

function getStatusColor(app: AppNode): string {
  if (app.isActiveOnly) return 'hsl(var(--destructive))';
  return app.hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))';
}

// ── App bubble component ───────────────────────────────────────────────────────

function AppBubble({ app, size = 40, highlighted = false, isSample = false }: { app: AppNode; size?: number; highlighted?: boolean; isSample?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);

  const content = (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        transition: 'transform 0.15s ease',
        cursor: 'pointer',
        '&:hover': { transform: 'scale(1.12)' },
      }}
    >
      {/* Highlight ring for category-matching apps */}
      {highlighted && (
        <Box
          sx={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 10px hsl(var(--primary) / 0.4)',
            pointerEvents: 'none',
          }}
        />
      )}
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
            opacity: highlighted || isSample ? 1 : 0.7,
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
            opacity: highlighted || isSample ? 1 : 0.7,
          }}
        >
          {app.name.charAt(0).toUpperCase()}
        </Avatar>
      )}
      {/* Status dot — hide for sample apps */}
      {!isSample && (
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
      )}
    </Box>
  );

  return (
    <Tooltip
      title={
        <Box sx={{ textAlign: 'left', p: 0.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
            {app.name}
          </Typography>
          {!isSample && (
            <Typography sx={{ fontSize: '0.7rem', color: app.hasValidAuth ? 'hsl(var(--severity-low))' : 'hsl(var(--muted-foreground))' }}>
              {app.hasValidAuth ? 'Authenticated' : app.isActiveOnly ? 'Not authenticated' : 'Inactive'}
            </Typography>
          )}
        </Box>
      }
      placement="bottom"
      arrow
    >
      {isSample ? content : (
        <Box component={Link} to={`/apps/${encodeURIComponent(app.name)}`} sx={{ textDecoration: 'none' }}>
          {content}
        </Box>
      )}
    </Tooltip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UsecaseAlluvialDiagram({
  sourceCategory,
  targetCategory,
  highlightCategory,
}: UsecaseAlluvialDiagramProps) {
  const navigate = useNavigate();
  const isLoggedIn = !!API_CONFIG.apiKey;
  const [allApps, setAllApps] = useState<AppNode[]>([]);
  const [ingestAppNames, setIngestAppNames] = useState<Set<string> | null>(null);
  const [forwardAppNames, setForwardAppNames] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState<'left' | 'right' | null>(null);

  // Fetch authenticated + active apps, and ingest workflow
  useEffect(() => {
    if (!API_CONFIG.apiKey) { setLoading(false); return; }

    (async () => {
      try {
        // Parallel fetch: auth apps, active apps, workflows
        const [authRes, appsRes, workflowsRes] = await Promise.all([
          fetch(getApiUrl('/api/v1/apps/authentication'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
          fetch(getApiUrl('/api/v1/apps'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
          fetch(getApiUrl('/api/v1/workflows'), {
            credentials: 'include',
            headers: { ...getAuthHeader() },
          }),
        ]);

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
        if (appsRes.ok) {
          try {
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
          } catch (_) {}
        }

        // Parse ingest & forward workflows
        if (workflowsRes.ok) {
          try {
            const wfData = await workflowsRes.json();
            const workflows = Array.isArray(wfData) ? wfData : (wfData.workflows || []);
            const ingestWf = findIngestTicketsWorkflow(workflows);
            if (ingestWf) {
              setIngestAppNames(extractWorkflowAppNames(ingestWf));
            }
            const forwardWf = findForwardTicketsWorkflow(workflows);
            if (forwardWf) {
              setForwardAppNames(extractWorkflowAppNames(forwardWf));
            }
          } catch (_) {}
        }

        setAllApps(nodes);
      } catch (err) {
        console.error('[AlluvialDiagram] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Source apps: if highlightCategory is set, show all ingest workflow apps
  // Otherwise fall back to category-based filtering
  const sourceApps = useMemo(() => {
    if (!isLoggedIn) {
      // Show sample apps for the source category when not logged in
      const samples = highlightCategory ? getSampleApps(highlightCategory) : getSampleApps(sourceCategory);
      return samples.map(a => ({ ...a, isHighlighted: true }));
    }
    if (highlightCategory && ingestAppNames && ingestAppNames.size > 0) {
      const ingestNodes = allApps.filter(a =>
        ingestAppNames.has(normalizeAppName(a.name)) && !isShuffleInternalApp(a.name)
      );
      return ingestNodes.map(a => ({
        ...a,
        isHighlighted: matchesCategory(a.name, highlightCategory),
      }));
    }
    return allApps.filter(a => matchesCategory(a.name, sourceCategory));
  }, [allApps, sourceCategory, highlightCategory, ingestAppNames, isLoggedIn]);

  // Target/destination apps: use Forward Tickets workflow as source of truth when available
  const targetApps = useMemo(() => {
    if (!isLoggedIn) {
      return getSampleApps(targetCategory);
    }
    if (highlightCategory && forwardAppNames && forwardAppNames.size > 0) {
      return allApps.filter(a =>
        forwardAppNames.has(normalizeAppName(a.name)) && matchesCategory(a.name, targetCategory)
      );
    }
    return allApps.filter(a => matchesCategory(a.name, targetCategory));
  }, [allApps, targetCategory, highlightCategory, forwardAppNames]);

  const sourceMeta = TOOL_CATEGORIES.find(c => c.id === sourceCategory);
  const targetMeta = TOOL_CATEGORIES.find(c => c.id === targetCategory);

  // Source label: when showing ingest apps, label as "Ingestion Sources"
  const sourceLabel = highlightCategory ? 'Ingestion Sources' : (sourceMeta?.label || sourceCategory);

  // SVG dimensions
  const nodeSize = 40;
  const colWidth = 80;
  const svgPadding = 20;
  const rowGap = 16;
  const addButtonSpace = 48; // space for the + button below apps

  const maxNodes = Math.max(sourceApps.length, targetApps.length, 1);
  const colHeight = maxNodes * (nodeSize + rowGap) - rowGap;
  const svgHeight = colHeight + svgPadding * 2 + 40 + addButtonSpace;
  const svgWidth = colWidth * 3 + 300;

  const leftX = svgPadding + nodeSize / 2;
  const centerX = svgWidth / 2;
  const rightX = svgWidth - svgPadding - nodeSize / 2;

  const getY = (idx: number, total: number) => {
    const totalHeight = total * (nodeSize + rowGap) - rowGap;
    const startY = (svgHeight - 30) / 2 - totalHeight / 2 + nodeSize / 2;
    return startY + idx * (nodeSize + rowGap);
  };

  const centerY = (svgHeight - 30) / 2;

  // Y position for the add button (below the last app, or at center if no apps)
  const getAddButtonY = (appCount: number) => {
    if (appCount === 0) return centerY;
    const lastY = getY(appCount - 1, appCount);
    return lastY + nodeSize / 2 + rowGap + 16;
  };

  const makePath = (fromX: number, fromY: number, toX: number, toY: number) => {
    const cx1 = fromX + (toX - fromX) * 0.45;
    const cx2 = fromX + (toX - fromX) * 0.55;
    // When fromY ≈ toY the bezier is flat/invisible — add a slight arc
    const yDiff = Math.abs(fromY - toY);
    if (yDiff < 8) {
      const bulge = 20; // vertical offset to create visible curvature
      return `M ${fromX} ${fromY} C ${cx1} ${fromY - bulge}, ${cx2} ${toY - bulge}, ${toX} ${toY}`;
    }
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
      <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <svg
          width={svgWidth}
          height={svgHeight + 30}
          viewBox={`0 0 ${svgWidth} ${svgHeight + 30}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="flow-gradient-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="flow-gradient-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
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

          {/* Animated particles — only for authenticated source apps */}
          {sourceApps.map((app, i) => {
            if (!app.hasValidAuth) return null;
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
          {sourceApps.some(app => app.hasValidAuth) && targetApps.map((_, i) => {
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
            {sourceLabel}
          </text>
          <text x={centerX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            Shuffle
          </text>
          <text x={rightX} y={svgHeight + 16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontWeight="600">
            {targetMeta?.label || targetCategory}
          </text>
        </svg>

        {/* Overlay HTML app bubbles */}
        <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: svgWidth, height: svgHeight + 30, pointerEvents: 'none' }}>
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
                <AppBubble app={app} size={nodeSize} highlighted={!!app.isHighlighted} isSample={!isLoggedIn} />
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
            <Tooltip title="Shuffle Datastore" placement="bottom" arrow>
              <Box
                component="img"
                src={shuffleInfraLogo}
                alt="Shuffle"
                sx={{ width: 48, height: 48, objectFit: 'contain' }}
              />
            </Tooltip>
          </Box>

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
                <AppBubble app={app} size={nodeSize} isSample={!isLoggedIn} />
              </Box>
            );
          })}

          {/* Add source tool button */}
          <Box
            sx={{
              position: 'absolute',
              left: leftX - 16,
              top: getAddButtonY(sourceApps.length),
              pointerEvents: 'auto',
            }}
          >
            <Tooltip title="Add source tools" placement="bottom" arrow>
              <IconButton
                onClick={() => setSearchOpen('left')}
                sx={{
                  width: 32,
                  height: 32,
                  border: '2px dashed hsla(var(--muted-foreground) / 0.3)',
                  color: 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary))',
                    bgcolor: 'hsla(var(--primary) / 0.08)',
                  },
                }}
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Add destination tool button */}
          <Box
            sx={{
              position: 'absolute',
              left: rightX - 16,
              top: getAddButtonY(targetApps.length),
              pointerEvents: 'auto',
            }}
          >
            <Tooltip title="Add destination tools" placement="bottom" arrow>
              <IconButton
                onClick={() => setSearchOpen('right')}
                sx={{
                  width: 32,
                  height: 32,
                  border: '2px dashed hsla(var(--muted-foreground) / 0.3)',
                  color: 'hsl(var(--muted-foreground))',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary))',
                    bgcolor: 'hsla(var(--primary) / 0.08)',
                  },
                }}
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* App search drawer — shared component */}
      <AppSearchDrawer
        open={searchOpen !== null}
        onClose={() => setSearchOpen(null)}
        initialQuery={
          searchOpen === 'left'
            ? (sourceMeta?.label || highlightCategory || sourceCategory)
            : (targetMeta?.label || targetCategory)
        }
        title={`Add ${searchOpen === 'left' ? (sourceLabel) : (targetMeta?.label || targetCategory)} Tool`}
        subtitle="Search and authenticate an integration"
      />

      {!hasApps && (
        <Typography sx={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', mt: 2 }}>
          No {sourceMeta?.label} or {targetMeta?.label} tools connected yet.{' '}
          <Box component={Link} to="/onboarding/sources" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
            Connect tools
          </Box>
        </Typography>
      )}
    </Box>
  );
}
