import { useState } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Clock, 
  Wrench,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface Challenge {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  valueProp: string;
}

const challenges: Challenge[] = [
  {
    id: 'alert-fatigue',
    label: 'Alert Fatigue',
    description: 'Too many alerts, not enough context',
    icon: <AlertTriangle size={28} />,
    valueProp: 'Auto-correlate and deduplicate alerts across all your tools',
  },
  {
    id: 'slow-response',
    label: 'Slow Response',
    description: 'Takes too long to investigate and respond',
    icon: <Clock size={28} />,
    valueProp: 'Automate enrichment and response in seconds, not hours',
  },
  {
    id: 'manual-work',
    label: 'Manual Work',
    description: 'Copy-pasting between tools all day',
    icon: <Wrench size={28} />,
    valueProp: 'Connect your stack and let automation handle the busywork',
  },
];

interface WelcomeStepProps {
  onSelect: (challengeId: string) => void;
  selectedChallenge: string | null;
}

export const WelcomeStep = ({ onSelect, selectedChallenge }: WelcomeStepProps) => {
  const [hoveredChallenge, setHoveredChallenge] = useState<string | null>(null);
  const activeChallenge = challenges.find(c => c.id === selectedChallenge);

  return (
    <Box sx={{ textAlign: 'center', py: { xs: 2, md: 4 } }}>
      {/* Animated Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.75,
            mb: 3,
            backgroundColor: 'hsl(var(--primary) / 0.1)',
            border: '1px solid hsl(var(--primary) / 0.3)',
            borderRadius: '100px',
          }}
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Sparkles size={16} color="#FF6600" />
          </motion.div>
          <Typography variant="caption" sx={{ color: 'hsl(var(--primary))', fontWeight: 600, letterSpacing: '0.5px' }}>
            WELCOME TO SHUFFLE
          </Typography>
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            mb: 2,
            color: 'hsl(var(--foreground))',
            fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
            lineHeight: 1.2,
          }}
        >
          What's your biggest
          <br />
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 50%, hsl(var(--primary-glow)) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            security challenge?
          </Box>
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Typography
          variant="body1"
          sx={{
            color: 'hsl(var(--muted-foreground))',
            mb: 5,
            maxWidth: 480,
            mx: 'auto',
          }}
        >
          We'll tailor your setup based on what matters most to you.
        </Typography>
      </motion.div>

      {/* Challenge Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          maxWidth: 900,
          mx: 'auto',
          mb: 4,
        }}
      >
        {challenges.map((challenge, index) => {
          const isSelected = selectedChallenge === challenge.id;
          const isHovered = hoveredChallenge === challenge.id;
          
          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            >
              <Box
                onClick={() => onSelect(challenge.id)}
                onMouseEnter={() => setHoveredChallenge(challenge.id)}
                onMouseLeave={() => setHoveredChallenge(null)}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  cursor: 'pointer',
                  backgroundColor: isSelected 
                    ? 'hsl(var(--primary) / 0.12)' 
                    : 'transparent',
                  border: '2px solid',
                  borderColor: isSelected 
                    ? 'hsl(var(--primary))' 
                    : isHovered 
                      ? 'hsl(var(--primary) / 0.4)' 
                      : 'hsl(var(--border))',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered || isSelected ? 'translateY(-4px)' : 'none',
                  boxShadow: isSelected 
                    ? '0 20px 40px -12px hsl(var(--primary) / 0.25)' 
                    : isHovered 
                      ? 'var(--shadow-lg)' 
                      : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': isSelected ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                  } : {},
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: isSelected 
                      ? 'hsl(var(--primary) / 0.2)' 
                      : 'hsl(var(--muted))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {challenge.icon}
                </Box>
                
                <Typography
                  variant="h6"
                  sx={{
                    color: 'hsl(var(--foreground))',
                    fontWeight: 700,
                    mb: 1,
                  }}
                >
                  {challenge.label}
                </Typography>
                
                <Typography
                  variant="body2"
                  sx={{
                    color: 'hsl(var(--muted-foreground))',
                    lineHeight: 1.6,
                  }}
                >
                  {challenge.description}
                </Typography>

                {/* Check indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: 'hsl(var(--primary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ArrowRight size={14} color="white" />
                    </Box>
                  </motion.div>
                )}
              </Box>
            </motion.div>
          );
        })}
      </Box>

      {/* Value Proposition Display */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ 
          opacity: activeChallenge ? 1 : 0, 
          height: activeChallenge ? 'auto' : 0 
        }}
        transition={{ duration: 0.3 }}
      >
        {activeChallenge && (
          <Box
            sx={{
              mt: 2,
              p: 3,
              backgroundColor: 'hsl(var(--severity-low) / 0.08)',
              border: '1px solid hsl(var(--severity-low) / 0.2)',
              borderRadius: 3,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            <Typography
              variant="body1"
              sx={{
                color: '#22c55e',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              <Sparkles size={18} />
              {activeChallenge.valueProp}
            </Typography>
          </Box>
        )}
      </motion.div>
    </Box>
  );
};
