/**
 * DataFlowDetailPage — Standalone page for a single data flow.
 * Route: /infrastructure/flows/:flowId
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Chip, Button, IconButton, Avatar, Skeleton } from '@mui/material';
import { ArrowRight, ArrowLeft, Bot, Check, Link as LinkIcon, Copy } from 'lucide-react';
import UsecaseAlluvialDiagram from '@/components/usecases/UsecaseAlluvialDiagram';
import { Clock } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { API_CONFIG, getApiUrl, getAuthHeader } from '@/config/api';
import { deduplicateAuthApps, type AuthAppEntry } from '@/lib/utils';
import {
  DEFAULT_USECASES,
  TOOL_CATEGORIES,
  FLOW_PHASES,
  CATEGORY_KEYWORDS,
  matchAppToCategory,
  type Usecase,
  type FlowPhase,
} from '@/config/usecases';
import { getToolCategoryMeta } from '@/pages/dashboard/InfrastructurePage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchedApp {
  name: string;
  image: string;
  hasValidAuth?: boolean;
}

// ── Tag colors (shared with InfrastructurePage) ────────────────────────────────

const TAG_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Alert:       { color: 'hsl(var(--infra-siem))',         bg: 'hsla(var(--infra-siem) / 0.1)',         border: 'hsla(var(--infra-siem) / 0.25)' },
  Detection:   { color: 'hsl(var(--infra-edr))',          bg: 'hsla(var(--infra-edr) / 0.1)',          border: 'hsla(var(--infra-edr) / 0.25)' },
  Logs:        { color: 'hsl(var(--infra-network))',      bg: 'hsla(var(--infra-network) / 0.1)',      border: 'hsla(var(--infra-network) / 0.25)' },
  Intel:       { color: 'hsl(var(--infra-threat-intel))', bg: 'hsla(var(--infra-threat-intel) / 0.1)', border: 'hsla(var(--infra-threat-intel) / 0.25)' },
  Response:    { color: 'hsl(var(--infra-case-mgmt))',    bg: 'hsla(var(--infra-case-mgmt) / 0.1)',    border: 'hsla(var(--infra-case-mgmt) / 0.25)' },
  Prevention:  { color: 'hsl(var(--infra-iam))',          bg: 'hsla(var(--infra-iam) / 0.1)',          border: 'hsla(var(--infra-iam) / 0.25)' },
  Containment: { color: 'hsl(var(--destructive))',        bg: 'hsla(var(--destructive) / 0.08)',       border: 'hsla(var(--destructive) / 0.2)' },
  Correlation: { color: 'hsl(var(--infra-cloud))',        bg: 'hsla(var(--infra-cloud) / 0.1)',        border: 'hsla(var(--infra-cloud) / 0.25)' },
  Context:     { color: 'hsl(var(--infra-asset-mgmt))',   bg: 'hsla(var(--infra-asset-mgmt) / 0.1)',  border: 'hsla(var(--infra-asset-mgmt) / 0.25)' },
};
const DEFAULT_TAG_COLOR = { color: 'hsl(var(--muted-foreground))', bg: 'hsla(var(--muted-foreground) / 0.08)', border: 'hsla(var(--muted-foreground) / 0.2)' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPhaseInfo(phase: FlowPhase) {
  return FLOW_PHASES.find(p => p.id === phase) || FLOW_PHASES[0];
}

function getRelatedFlows(flow: Usecase): Usecase[] {
  return DEFAULT_USECASES.filter(
    f => f.id !== flow.id && (f.source === flow.source || f.target === flow.target || f.source === flow.target || f.target === flow.source)
  );
}

function getCategoryDetails(categoryId: string) {
  return TOOL_CATEGORIES.find(c => c.id === categoryId);
}

// ── Section component ──────────────────────────────────────────────────────────

const Section = ({ title, children, borderBottom = true }: { title: string; children: React.ReactNode; borderBottom?: boolean }) => (
  <Box sx={{ py: 3, borderBottom: borderBottom ? '1px solid hsl(var(--border))' : 'none' }}>
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

// ── Connection Endpoint ─────────────────────────────────────────────────────────

const ConnectionEndpoint = ({
  label,
  category,
  categoryDetails,
  apps,
  loading,
  selectedApps,
  onToggleApp,
}: {
  label: string;
  category: ReturnType<typeof getToolCategoryMeta>;
  categoryDetails: typeof TOOL_CATEGORIES[number] | undefined;
  apps: MatchedApp[];
  loading: boolean;
  selectedApps: Set<string>;
  onToggleApp: (appName: string) => void;
}) => {
  const colorVar = category?.color || '--primary';
  const hasApps = apps.length > 0;

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
        {label}
      </Typography>

      {/* Category header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: `hsla(var(${colorVar}) / 0.06)`,
        border: `1px solid hsla(var(${colorVar}) / 0.15)`,
      }}>
        {category && (
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `hsla(var(${colorVar}) / 0.12)`,
            color: `hsl(var(${colorVar}))`,
            flexShrink: 0,
          }}>
            {category.icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: `hsl(var(${colorVar}))` }}>
            {category?.label || 'Unknown'}
          </Typography>
          {categoryDetails && (
            <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4, mt: 0.25 }} noWrap>
              {categoryDetails.description.split('—')[0].trim()}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Apps list */}
      <Box sx={{ pl: 0.5 }}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
          Your Tools {hasApps && selectedApps.size > 0 && `(${selectedApps.size} selected)`}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={32} sx={{ borderRadius: 1.5, bgcolor: 'hsla(var(--muted-foreground) / 0.08)' }} />)}
          </Box>
        ) : hasApps ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {apps.map(app => {
              const isSelected = selectedApps.has(app.name);
              return (
                <Box
                  key={app.name}
                  onClick={() => onToggleApp(app.name)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    border: isSelected
                      ? `1px solid hsla(var(${colorVar}) / 0.4)`
                      : app.hasValidAuth
                        ? `1px solid hsla(142 71% 45% / 0.2)`
                        : '1px solid hsl(var(--border))',
                    bgcolor: isSelected
                      ? `hsla(var(${colorVar}) / 0.08)`
                      : app.hasValidAuth
                        ? 'hsla(142 71% 45% / 0.04)'
                        : 'transparent',
                    '&:hover': {
                      bgcolor: isSelected
                        ? `hsla(var(${colorVar}) / 0.12)`
                        : 'hsla(var(--muted-foreground) / 0.06)',
                    },
                  }}
                >
                  <Avatar
                    src={app.image}
                    alt={app.name}
                    sx={{ width: 22, height: 22, bgcolor: 'hsla(var(--muted-foreground) / 0.1)' }}
                  >
                    {app.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
                    {app.name}
                  </Typography>
                  {isSelected && (
                    <Check size={14} style={{ color: `hsl(var(${colorVar}))` }} />
                  )}
                  {!isSelected && app.hasValidAuth && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'hsl(142 71% 45%)', flexShrink: 0 }} />
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{
            py: 2, px: 1.5,
            borderRadius: 1.5,
            border: '1px dashed hsla(var(--muted-foreground) / 0.25)',
            textAlign: 'center',
          }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              No tools configured
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'hsla(var(--muted-foreground) / 0.6)', mt: 0.5 }}>
              {categoryDetails?.examples.slice(0, 3).join(', ')}…
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const DataFlowDetailPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const flow = DEFAULT_USECASES.find(f => f.id === flowId);

  // Fetch authenticated apps from the API
  const [categoryApps, setCategoryApps] = useState<Record<string, MatchedApp[]>>({});
  const [appsLoading, setAppsLoading] = useState(true);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          credentials: 'include',
          headers: getAuthHeader(),
        });
        if (!res.ok) return;
        const authData = await res.json();
        if (!Array.isArray(authData)) return;

        const dedupedApps = deduplicateAuthApps(authData);
        const mapped: Record<string, MatchedApp[]> = {};

        dedupedApps.forEach(({ app, bestImage, hasValidAuth }) => {
          const catId = matchAppToCategory(app.name, app.categories || []);
          if (!catId) return;
          if (!mapped[catId]) mapped[catId] = [];
          mapped[catId].push({ name: app.name, image: bestImage || app.large_image || '', hasValidAuth });
        });

        setCategoryApps(mapped);
      } catch (e) {
        console.error('Failed to fetch apps:', e);
      } finally {
        setAppsLoading(false);
      }
    };
    fetchApps();
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  // Parse selected tools from URL
  const selectedSourceApps = useMemo(() => {
    const param = searchParams.get('source_tools');
    return new Set(param ? param.split(',').map(s => s.trim()).filter(Boolean) : []);
  }, [searchParams]);

  const selectedTargetApps = useMemo(() => {
    const param = searchParams.get('target_tools');
    return new Set(param ? param.split(',').map(s => s.trim()).filter(Boolean) : []);
  }, [searchParams]);

  const updateUrlParams = useCallback((key: string, selected: Set<string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (selected.size > 0) {
        next.set(key, Array.from(selected).join(','));
      } else {
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleSourceApp = useCallback((appName: string) => {
    const next = new Set(selectedSourceApps);
    if (next.has(appName)) next.delete(appName); else next.add(appName);
    updateUrlParams('source_tools', next);
  }, [selectedSourceApps, updateUrlParams]);

  const toggleTargetApp = useCallback((appName: string) => {
    const next = new Set(selectedTargetApps);
    if (next.has(appName)) next.delete(appName); else next.add(appName);
    updateUrlParams('target_tools', next);
  }, [selectedTargetApps, updateUrlParams]);

  const hasSelection = selectedSourceApps.size > 0 || selectedTargetApps.size > 0;

  const copyShareLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
  }, []);

  usePageMeta({
    title: flow ? `${flow.label} — Data Flow` : 'Data Flow Not Found',
    description: flow?.description || 'Data flow detail page',
  });

  if (!flow) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.2rem', color: 'hsl(var(--muted-foreground))', mb: 2 }}>
          Data flow not found
        </Typography>
        <Button onClick={() => navigate('/usecases')} sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}>
          ← Back to Usecases
        </Button>
      </Box>
    );
  }

  const sourceCat = getToolCategoryMeta(flow.source);
  const targetCat = getToolCategoryMeta(flow.target);
  const sourceDetails = getCategoryDetails(flow.source);
  const targetDetails = getCategoryDetails(flow.target);
  const phaseInfo = getPhaseInfo(flow.phase);
  const related = getRelatedFlows(flow);
  const headerColor = sourceCat?.color || '--primary';
  const sourceApps = categoryApps[flow.source] || [];
  const targetApps = categoryApps[flow.target] || [];

  // Find current index for prev/next navigation
  const currentIdx = DEFAULT_USECASES.findIndex(f => f.id === flow.id);
  const prevFlow = currentIdx > 0 ? DEFAULT_USECASES[currentIdx - 1] : null;
  const nextFlow = currentIdx < DEFAULT_USECASES.length - 1 ? DEFAULT_USECASES[currentIdx + 1] : null;

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', pb: 6 }}>
      {/* Back nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Button
          onClick={() => navigate('/usecases')}
          startIcon={<ArrowLeft size={14} />}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsla(var(--muted-foreground) / 0.08)' },
          }}
        >
          Usecases
        </Button>
      </Box>

      {/* Hero header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 3,
        mb: 4,
        p: 4,
        borderRadius: 3,
        border: '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--card))',
        background: `linear-gradient(135deg, hsla(var(${headerColor}) / 0.06) 0%, hsl(var(--card)) 60%)`,
      }}>
        <Box sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `hsla(var(${headerColor}) / 0.12)`,
          color: `hsl(var(${headerColor}))`,
          flexShrink: 0,
        }}>
          {sourceCat?.icon || <ArrowRight size={24} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--foreground))', mb: 0.5, lineHeight: 1.2 }}>
            {flow.label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            {/* Phase badge */}
            <Typography sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              px: 1,
              py: 0.3,
              borderRadius: 1,
              bgcolor: `hsla(var(${phaseInfo.color}) / 0.12)`,
              color: `hsl(var(${phaseInfo.color}))`,
              border: `1px solid hsla(var(${phaseInfo.color}) / 0.25)`,
            }}>
              Step {phaseInfo.step}: {phaseInfo.label}
            </Typography>
            {flow.manualVerification && (
              <Typography sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                px: 1,
                py: 0.3,
                borderRadius: 1,
                bgcolor: 'hsla(45 93% 47% / 0.1)',
                color: 'hsl(45 93% 47%)',
                border: '1px solid hsla(45 93% 47% / 0.25)',
              }}>
                Manual Verification
              </Typography>
            )}
          </Box>
          {/* Tags */}
          {flow.tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {flow.tags.map(tag => {
                const tc = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR;
                return (
                  <Typography key={tag} sx={{ fontSize: '0.65rem', px: 1, py: 0.3, borderRadius: 1, fontWeight: 600, letterSpacing: '0.04em', color: tc.color, bgcolor: tc.bg, border: `1px solid ${tc.border}` }}>
                    {tag}
                  </Typography>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Coming soon banner for non-first-three usecases */}
      {!['siem_case_management_1', 'edr_case_management_1', 'email_case_management_1'].includes(flow.id) && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          mb: 3,
          borderRadius: 2,
          border: '1px solid hsla(45 93% 47% / 0.3)',
          bgcolor: 'hsla(45 93% 47% / 0.06)',
        }}>
          <Clock size={18} style={{ color: 'hsl(45 93% 47%)', flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(45 93% 47%)' }}>
              Coming Soon
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              This usecase is not yet available for automated setup. Stay tuned for updates.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Connection Path */}
      <Box sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--card))',
        mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Connection Path
          </Typography>
          {flow.id !== 'siem_case_management_1' && hasSelection && (
            <Button
              size="small"
              startIcon={<Copy size={12} />}
              onClick={copyShareLink}
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'hsl(var(--primary))',
                textTransform: 'none',
                py: 0.25,
                px: 1,
                minHeight: 0,
                '&:hover': { bgcolor: 'hsla(var(--primary) / 0.08)' },
              }}
            >
              Copy share link
            </Button>
          )}
        </Box>
        {['siem_case_management_1', 'edr_case_management_1', 'email_case_management_1'].includes(flow.id) ? (
          <UsecaseAlluvialDiagram
            sourceCategory={flow.source}
            targetCategory={flow.target}
            highlightCategory={flow.source}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
            {/* Source */}
            <ConnectionEndpoint
              label="Source"
              category={sourceCat}
              categoryDetails={sourceDetails}
              apps={sourceApps}
              loading={appsLoading}
              selectedApps={selectedSourceApps}
              onToggleApp={toggleSourceApp}
            />

            {/* Arrow */}
            <Box sx={{ display: 'flex', alignItems: 'center', pt: 3 }}>
              <ArrowRight size={22} style={{ color: 'hsl(var(--muted-foreground))' }} />
            </Box>

            {/* Target */}
            <ConnectionEndpoint
              label="Destination"
              category={targetCat}
              categoryDetails={targetDetails}
              apps={targetApps}
              loading={appsLoading}
              selectedApps={selectedTargetApps}
              onToggleApp={toggleTargetApp}
            />
          </Box>
        )}
      </Box>

      {/* Two-column layout: Description + Agentic */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Why This Matters */}
        <Box sx={{
          p: 3.5,
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Why This Matters
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', color: 'hsla(var(--foreground) / 0.85)', lineHeight: 1.85 }}>
            {flow.description}
          </Typography>
        </Box>

        {/* Agentic Mode */}
        <Box sx={{
          p: 3.5,
          borderRadius: 3,
          border: `1px solid hsla(var(${headerColor}) / 0.25)`,
          bgcolor: `hsla(var(${headerColor}) / 0.03)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Agentic Mode
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Bot size={15} style={{ color: `hsl(var(${headerColor}))` }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: `hsl(var(${headerColor}))` }}>
              AI Agent Behavior
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.9rem', color: 'hsla(var(--foreground) / 0.85)', lineHeight: 1.85 }}>
            {flow.agenticDescription}
          </Typography>
        </Box>
      </Box>

      {/* Source & Target category details */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {sourceDetails && (
          <CategoryCard category={sourceDetails} role="Source" />
        )}
        {targetDetails && (
          <CategoryCard category={targetDetails} role="Target" />
        )}
      </Box>




      {/* Prev / Next navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
        {prevFlow ? (
          <Button
            onClick={() => navigate(`/usecases/${prevFlow.id}`)}
            startIcon={<ArrowLeft size={14} />}
            sx={{
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsla(var(--muted-foreground) / 0.08)' },
            }}
          >
            {prevFlow.label}
          </Button>
        ) : <Box />}
        {nextFlow ? (
          <Button
            onClick={() => navigate(`/usecases/${nextFlow.id}`)}
            endIcon={<ArrowRight size={14} />}
            sx={{
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsla(var(--muted-foreground) / 0.08)' },
            }}
          >
            {nextFlow.label}
          </Button>
        ) : <Box />}
      </Box>
    </Box>
  );
};

// ── Category detail card ───────────────────────────────────────────────────────

const CategoryCard = ({ category, role }: { category: typeof TOOL_CATEGORIES[number]; role: 'Source' | 'Target' }) => {
  const colorVar = category.color;
  return (
    <Box sx={{
      p: 3,
      borderRadius: 3,
      border: `1px solid hsla(var(${colorVar}) / 0.2)`,
      bgcolor: `hsla(var(${colorVar}) / 0.03)`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `hsla(var(${colorVar}) / 0.12)`,
          color: `hsl(var(${colorVar}))`,
        }}>
          {category.icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {role}
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: `hsl(var(${colorVar}))` }}>
            {category.label}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: '0.82rem', color: 'hsl(var(--foreground))', lineHeight: 1.7, mb: 2 }}>
        {category.description}
      </Typography>

      {/* Examples */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
          Examples
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {category.examples.slice(0, 6).map(ex => (
            <Typography key={ex} sx={{
              fontSize: '0.7rem',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: 'hsla(var(--muted-foreground) / 0.08)',
              color: 'hsl(var(--muted-foreground))',
              fontWeight: 500,
            }}>
              {ex}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Data In/Out */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(142 71% 45%)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
            Data In
          </Typography>
          {category.dataIn.slice(0, 3).map(d => (
            <Typography key={d} sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
              • {d}
            </Typography>
          ))}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'hsl(200 80% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
            Data Out
          </Typography>
          {category.dataOut.slice(0, 3).map(d => (
            <Typography key={d} sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
              • {d}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default DataFlowDetailPage;
