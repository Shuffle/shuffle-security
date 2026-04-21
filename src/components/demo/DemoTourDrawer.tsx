/**
 * Floating, non-modal tour drawer that narrates each step of the demo.
 *
 * Layout modes:
 * - dock = 'right'  → tall panel pinned to the right edge (default)
 * - dock = 'bottom' → short panel pinned along the bottom edge (use when you
 *   need the right side for app drawers, e.g. enabling/authenticating apps)
 *
 * It can also be minimized to a compact pill in the bottom-right so users can
 * reclaim screen space without losing tour progress.
 *
 * Does NOT block clicks on the underlying page.
 */

import { Box, IconButton, Typography, Button, LinearProgress, Tooltip } from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Lock,
  Check,
  Minus,
  PanelRight,
  PanelBottom,
} from 'lucide-react';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';
import { motion, AnimatePresence } from 'framer-motion';

export const DemoTourDrawer = () => {
  const {
    drawerOpen,
    minimized,
    dock,
    step,
    nextStep,
    prevStep,
    closeTour,
    goToStep,
    cleanup,
    isCleaning,
    currentStepUnlocked,
    completedSteps,
    minimizeTour,
    restoreTour,
    toggleDock,
    forceCreateIncidents,
    isForceCreatingIncidents,
    hasDemoIncidents,
  } = useDemo();

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const progress = ((step + 1) / total) * 100;
  const isLast = step === total - 1;
  const requirement = current?.requirement;
  const locked = !!requirement && !currentStepUnlocked;
  const isIncidentsListStep = current?.id === 'incidents-list';

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (drawerOpen && minimized) {
    return (
      <AnimatePresence>
        <motion.div
          key="demo-pill"
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 1300,
            pointerEvents: 'auto',
          }}
        >
          <Tooltip title={`${current.title} — click to expand`} arrow placement="left">
            <Box
              onClick={restoreTour}
              role="button"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                pl: 1.5,
                pr: 2,
                py: 1,
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                boxShadow: '0 16px 36px -12px hsl(0 0% 0% / 0.35), 0 0 0 1px hsl(var(--primary) / 0.08)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 20px 44px -12px hsl(0 0% 0% / 0.4), 0 0 0 1px hsl(var(--primary) / 0.18)',
                },
                maxWidth: 320,
              }}
            >
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <Sparkles size={14} />
                {locked && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: 'hsl(var(--primary))',
                      border: '2px solid hsl(var(--card))',
                    }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.1 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                  Demo · {step + 1}/{total}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'hsl(var(--foreground))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                  }}
                >
                  {current.title}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); closeTour(); }}
                sx={{ color: 'hsl(var(--muted-foreground))', ml: 0.5, '&:hover': { color: 'hsl(var(--foreground))' } }}
              >
                <X size={14} />
              </IconButton>
            </Box>
          </Tooltip>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Expanded drawer ──────────────────────────────────────────────────────
  const isBottom = dock === 'bottom';

  // Per-dock framer-motion + position styles
  const motionPos = isBottom
    ? { initial: { y: 320, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 320, opacity: 0 } }
    : { initial: { x: 480, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 480, opacity: 0 } };

  const containerStyle: React.CSSProperties = isBottom
    ? {
        position: 'fixed',
        left: 24,
        right: 24,
        bottom: 24,
        maxWidth: 'min(960px, calc(100vw - 32px))',
        marginLeft: 'auto',
        marginRight: 'auto',
        zIndex: 1300,
        pointerEvents: 'auto',
      }
    : {
        position: 'fixed',
        top: 24,
        right: 24,
        bottom: 24,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 1300,
        pointerEvents: 'auto',
      };

  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.div
          key={`demo-drawer-${dock}`}
          {...motionPos}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          style={containerStyle}
        >
          <Box
            sx={{
              height: isBottom ? 'auto' : '100%',
              maxHeight: isBottom ? 'min(360px, 60vh)' : '100%',
              display: 'flex',
              flexDirection: isBottom ? 'row' : 'column',
              borderRadius: 3,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              boxShadow: '0 24px 60px -16px hsl(0 0% 0% / 0.35), 0 0 0 1px hsl(var(--primary) / 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header (top for right dock, left rail for bottom dock) */}
            <Box
              sx={{
                ...(isBottom
                  ? {
                      width: 220,
                      flexShrink: 0,
                      borderRight: '1px solid hsl(var(--border))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      p: 2,
                    }
                  : {
                      px: 2.5,
                      py: 1.75,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid hsl(var(--border))',
                    }),
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                  }}
                >
                  <Sparkles size={15} />
                </Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Demo tour · {step + 1}/{total}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: isBottom ? 0 : 'auto' }}>
                <Tooltip title={isBottom ? 'Dock to right' : 'Dock to bottom'} arrow>
                  <IconButton onClick={toggleDock} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {isBottom ? <PanelRight size={15} /> : <PanelBottom size={15} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Minimize" arrow>
                  <IconButton onClick={minimizeTour} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    <Minus size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close tour" arrow>
                  <IconButton onClick={closeTour} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    <X size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
              {isBottom && (
                <Box sx={{ mt: 'auto' }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: 'hsl(var(--muted))',
                      '& .MuiLinearProgress-bar': { backgroundColor: 'hsl(var(--primary))', borderRadius: 2 },
                    }}
                  />
                  <Typography sx={{ mt: 1, fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
                    {step + 1} of {total} steps
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Progress (only for right dock — bottom dock has it in the rail) */}
            {!isBottom && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 3,
                  backgroundColor: 'hsl(var(--muted))',
                  '& .MuiLinearProgress-bar': { backgroundColor: 'hsl(var(--primary))' },
                }}
              />
            )}

            {/* Main content column */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Body */}
              <Box sx={{ p: isBottom ? 2.5 : 3, flex: 1, overflowY: 'auto' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Typography
                      sx={{
                        fontSize: isBottom ? '1rem' : '1.15rem',
                        fontWeight: 600,
                        color: 'hsl(var(--foreground))',
                        mb: 1.25,
                        lineHeight: 1.3,
                      }}
                    >
                      {current.title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        color: 'hsl(var(--foreground))',
                        fontWeight: 500,
                      }}
                    >
                      {current.body}
                    </Typography>
                    {current.bullets && current.bullets.length > 0 && (
                      <Box
                        component="ul"
                        sx={{
                          mt: 1.5,
                          mb: 0,
                          pl: 0,
                          listStyle: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.75,
                        }}
                      >
                        {current.bullets.map((b, i) => (
                          <Box
                            key={i}
                            component="li"
                            sx={{
                              fontSize: '0.85rem',
                              lineHeight: 1.5,
                              color: 'hsl(var(--muted-foreground))',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                mt: '0.55em',
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                backgroundColor: 'hsl(var(--primary))',
                                flexShrink: 0,
                              }}
                            />
                            <span>{b}</span>
                          </Box>
                        ))}
                      </Box>
                    )}

                    {(requirement || (current?.subGoals && current.subGoals.length > 0)) && (() => {
                      // Build a unified list of goals. If the step uses
                      // sub-goals, show them as separate rows so the user can
                      // see exactly what is left. Otherwise fall back to the
                      // single requirement label.
                      const goals = current?.subGoals && current.subGoals.length > 0
                        ? current.subGoals.map(g => ({
                            id: g.id,
                            label: g.label,
                            done: !!completedSteps[g.id],
                          }))
                        : requirement
                          ? [{
                              id: current.id,
                              label: requirement.label,
                              done: !!completedSteps[current.id],
                            }]
                          : [];
                      const allDone = goals.every(g => g.done);
                      return (
                        <Box
                          sx={{
                            mt: 2.5,
                            p: 1.75,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: allDone ? 'hsl(var(--severity-low) / 0.35)' : 'hsl(var(--primary) / 0.35)',
                            backgroundColor: allDone ? 'hsl(var(--severity-low) / 0.08)' : 'hsl(var(--primary) / 0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.25,
                          }}
                        >
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: allDone ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))' }}>
                            {allDone ? 'Done' : 'Required to continue'}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
                            {goals.map(g => (
                              <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Box
                                  sx={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 1,
                                    display: 'grid',
                                    placeItems: 'center',
                                    backgroundColor: g.done ? 'hsl(var(--severity-low) / 0.2)' : 'hsl(var(--primary) / 0.18)',
                                    color: g.done ? 'hsl(var(--severity-low))' : 'hsl(var(--primary))',
                                    flexShrink: 0,
                                  }}
                                >
                                  {g.done ? <Check size={13} /> : <Lock size={12} />}
                                </Box>
                                <Typography
                                  sx={{
                                    fontSize: '0.78rem',
                                    fontWeight: 500,
                                    color: 'hsl(var(--foreground))',
                                    lineHeight: 1.4,
                                    textDecoration: g.done ? 'line-through' : 'none',
                                    opacity: g.done ? 0.7 : 1,
                                  }}
                                >
                                  {g.label}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      );
                    })()}

                    {isLast && (
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--muted) / 0.4)',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(var(--foreground))', mb: 1 }}>
                          Ready to use real data?
                        </Typography>
                        <Button
                          onClick={cleanup}
                          disabled={isCleaning}
                          variant="outlined"
                          size="small"
                          fullWidth
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            borderColor: 'hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                            '&:hover': {
                              borderColor: 'hsl(var(--destructive) / 0.5)',
                              backgroundColor: 'hsl(var(--destructive) / 0.06)',
                              color: 'hsl(var(--destructive))',
                            },
                          }}
                        >
                          {isCleaning ? 'Cleaning up…' : 'Clean up all demo data'}
                        </Button>
                      </Box>
                    )}
                  </motion.div>
                </AnimatePresence>
              </Box>

              {/* Step dots (hidden in bottom dock to save vertical space) */}
              {!isBottom && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, px: 2, pb: 1.5 }}>
                  {TOUR_STEPS.map((s, i) => {
                    const isCurrent = i === step;
                    const hasSubGoals = !!s.subGoals && s.subGoals.length > 0;
                    const isComplete = hasSubGoals
                      ? s.subGoals!.every(g => !!completedSteps[g.id])
                      : !!completedSteps[s.id];
                    const hasReq = !!s.requirement || hasSubGoals;
                    return (
                      <Box
                        key={s.id}
                        onClick={() => goToStep(i)}
                        sx={{
                          cursor: 'pointer',
                          width: isCurrent ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: isCurrent
                            ? 'hsl(var(--primary))'
                            : hasReq && !isComplete
                              ? 'hsl(var(--primary) / 0.35)'
                              : 'hsl(var(--muted))',
                          transition: 'all 0.2s ease',
                          '&:hover': { backgroundColor: isCurrent ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)' },
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              {/* Footer */}
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  gap: 1,
                  borderTop: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                }}
              >
                <Button
                  onClick={prevStep}
                  disabled={step === 0}
                  variant="outlined"
                  size="small"
                  startIcon={<ChevronLeft size={14} />}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    '&:hover': { borderColor: 'hsl(var(--primary) / 0.5)', backgroundColor: 'hsl(var(--primary) / 0.06)' },
                    '&.Mui-disabled': { color: 'hsl(var(--muted-foreground) / 0.4)' },
                  }}
                >
                  Previous
                </Button>
                <Tooltip
                  title={
                    locked
                      ? (() => {
                          const pending = current?.subGoals?.find(g => !completedSteps[g.id]);
                          if (pending) return `Complete: ${pending.label}`;
                          if (requirement) return `Complete: ${requirement.label}`;
                          return '';
                        })()
                      : ''
                  }
                  arrow
                  disableHoverListener={!locked}
                >
                  <span style={{ flex: 1.4, display: 'flex' }}>
                    <Button
                      onClick={isLast ? closeTour : nextStep}
                      disabled={locked}
                      variant="contained"
                      size="small"
                      startIcon={locked ? <Lock size={13} /> : undefined}
                      endIcon={!isLast && !locked ? <ChevronRight size={14} /> : undefined}
                      sx={{
                        flex: 1,
                        textTransform: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                        boxShadow: 'none',
                        '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)', boxShadow: 'none' },
                        '&.Mui-disabled': {
                          backgroundColor: 'hsl(var(--muted))',
                          color: 'hsl(var(--muted-foreground))',
                        },
                      }}
                    >
                      {locked ? 'Locked' : isLast ? 'Finish' : 'Next'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoTourDrawer;
