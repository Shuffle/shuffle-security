/**
 * Floating, non-modal tour drawer that narrates each step of the demo.
 * Sits over the right edge of the viewport. Does NOT block clicks on the
 * underlying page — users can still freely explore.
 */

import { Box, IconButton, Typography, Button, LinearProgress, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight, X, Sparkles, Lock, Check } from 'lucide-react';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';
import { motion, AnimatePresence } from 'framer-motion';

export const DemoTourDrawer = () => {
  const { drawerOpen, step, nextStep, prevStep, closeTour, goToStep, cleanup, isCleaning, currentStepUnlocked, completedSteps } = useDemo();

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const progress = ((step + 1) / total) * 100;
  const isLast = step === total - 1;
  const requirement = current?.requirement;
  const locked = !!requirement && !currentStepUnlocked;

  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.div
          initial={{ x: 480, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 480, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            bottom: 24,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 1300,
            pointerEvents: 'auto',
          }}
        >
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              boxShadow: '0 24px 60px -16px hsl(0 0% 0% / 0.35), 0 0 0 1px hsl(var(--primary) / 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid hsl(var(--border))',
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
              <IconButton onClick={closeTour} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                <X size={16} />
              </IconButton>
            </Box>

            {/* Progress */}
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 3,
                backgroundColor: 'hsl(var(--muted))',
                '& .MuiLinearProgress-bar': { backgroundColor: 'hsl(var(--primary))' },
              }}
            />

            {/* Body */}
            <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
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
                      fontSize: '1.15rem',
                      fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      mb: 1.5,
                      lineHeight: 1.3,
                    }}
                  >
                    {current.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      lineHeight: 1.65,
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {current.body}
                  </Typography>

                  {requirement && (
                    <Box
                      sx={{
                        mt: 2.5,
                        p: 1.75,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: locked ? 'hsl(var(--primary) / 0.35)' : 'hsl(var(--severity-low) / 0.35)',
                        backgroundColor: locked ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--severity-low) / 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          display: 'grid',
                          placeItems: 'center',
                          backgroundColor: locked ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--severity-low) / 0.2)',
                          color: locked ? 'hsl(var(--primary))' : 'hsl(var(--severity-low))',
                          flexShrink: 0,
                        }}
                      >
                        {locked ? <Lock size={13} /> : <Check size={14} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: locked ? 'hsl(var(--primary))' : 'hsl(var(--severity-low))', mb: 0.25 }}>
                          {locked ? 'Required to continue' : 'Done'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'hsl(var(--foreground))', lineHeight: 1.4 }}>
                          {requirement.label}
                        </Typography>
                      </Box>
                    </Box>
                  )}

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

            {/* Step dots */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, px: 2, pb: 1.5 }}>
              {TOUR_STEPS.map((s, i) => {
                const isCurrent = i === step;
                const isComplete = !!completedSteps[s.id];
                const hasReq = !!s.requirement;
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
                title={locked && requirement ? `Complete: ${requirement.label}` : ''}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoTourDrawer;
