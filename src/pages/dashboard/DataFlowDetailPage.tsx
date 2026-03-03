/**
 * DataFlowDetailPage — Standalone page for a single data flow.
 * Route: /infrastructure/flows/:flowId
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Button, IconButton, Avatar, Skeleton } from '@mui/material';
import { ArrowRight, ArrowLeft, Bot, Check } from 'lucide-react';
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
}: {
  label: string;
  category: ReturnType<typeof getToolCategoryMeta>;
  categoryDetails: typeof TOOL_CATEGORIES[number] | undefined;
  apps: MatchedApp[];
  loading: boolean;
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
          Your Tools
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={32} sx={{ borderRadius: 1.5, bgcolor: 'hsla(var(--muted-foreground) / 0.08)' }} />)}
          </Box>
        ) : hasApps ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {apps.map(app => (
              <Box key={app.name} sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1,
                borderRadius: 1.5,
                border: app.hasValidAuth ? `1px solid hsla(142 71% 45% / 0.2)` : '1px solid hsl(var(--border))',
                bgcolor: app.hasValidAuth ? 'hsla(142 71% 45% / 0.04)' : 'transparent',
              }}>
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
                {app.hasValidAuth && (
                  <Check size={14} style={{ color: 'hsl(142 71% 45%)' }} />
                )}
              </Box>
            ))}
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
        <Button onClick={() => navigate('/infrastructure')} sx={{ color: 'hsl(var(--primary))', textTransform: 'none' }}>
          ← Back to Infrastructure
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
          onClick={() => navigate('/infrastructure')}
          startIcon={<ArrowLeft size={14} />}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            '&:hover': { color: 'hsl(var(--foreground))', bgcolor: 'hsla(var(--muted-foreground) / 0.08)' },
          }}
        >
          Infrastructure
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

      {/* Connection Path */}
      <Box sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid hsl(var(--border))',
        bgcolor: 'hsl(var(--card))',
        mb: 3,
      }}>
        <Section title="Connection Path" borderBottom={false}>
          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
            {/* Source */}
            <ConnectionEndpoint
              label="Source"
              category={sourceCat}
              categoryDetails={sourceDetails}
              apps={sourceApps}
              loading={appsLoading}
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
            />
          </Box>
        </Section>
      </Box>

      {/* Two-column layout: Description + Agentic */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Why This Matters */}
        <Box sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
        }}>
          <Section title="Why This Matters" borderBottom={false}>
            <Typography sx={{ fontSize: '0.88rem', color: 'hsl(var(--foreground))', lineHeight: 1.8 }}>
              {flow.description}
            </Typography>
          </Section>
        </Box>

        {/* Agentic Mode */}
        <Box sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid hsla(var(--primary) / 0.2)',
          bgcolor: 'hsla(var(--primary) / 0.03)',
        }}>
          <Section title="Agentic Mode" borderBottom={false}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Bot size={16} style={{ color: 'hsl(var(--primary))' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                AI Agent Behavior
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', lineHeight: 1.8 }}>
              {flow.agenticDescription}
            </Typography>
          </Section>
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

      {/* Automation info */}
      {(flow.automationLabel || flow.automationCategory || flow.automationArea) && (
        <Box sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          mb: 3,
        }}>
          <Section title="Automation Configuration" borderBottom={false}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {flow.automationLabel && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, mb: 0.5 }}>
                    Workflow Label
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600, fontFamily: 'monospace' }}>
                    {flow.automationLabel}
                  </Typography>
                </Box>
              )}
              {flow.automationCategory && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, mb: 0.5 }}>
                    Category
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600, fontFamily: 'monospace' }}>
                    {flow.automationCategory}
                  </Typography>
                </Box>
              )}
              {flow.automationArea && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600, mb: 0.5 }}>
                    Area
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                    {flow.automationArea.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Typography>
                </Box>
              )}
            </Box>
          </Section>
        </Box>
      )}

      {/* Related flows */}
      {related.length > 0 && (
        <Box sx={{
          p: 3,
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          mb: 3,
        }}>
          <Section title={`Related Data Flows (${related.length})`} borderBottom={false}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {related.map(rf => {
                const rSrc = getToolCategoryMeta(rf.source);
                const rTgt = getToolCategoryMeta(rf.target);
                return (
                  <Box
                    key={rf.id}
                    onClick={() => navigate(`/infrastructure/flows/${rf.id}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      px: 1.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'hsla(var(--muted-foreground) / 0.06)' },
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: rSrc ? `hsl(var(${rSrc.color}))` : 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
                      {rf.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                      {rSrc?.label || rf.source} → {rTgt?.label || rf.target}
                    </Typography>
                    <ArrowRight size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                  </Box>
                );
              })}
            </Box>
          </Section>
        </Box>
      )}

      {/* Prev / Next navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 2 }}>
        {prevFlow ? (
          <Button
            onClick={() => navigate(`/infrastructure/flows/${prevFlow.id}`)}
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
            onClick={() => navigate(`/infrastructure/flows/${nextFlow.id}`)}
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
