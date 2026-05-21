import type { ReactNode } from 'react';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AgentIcon } from '@shuffleio/shuffle-mcps';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';

export interface ProductChoiceStepProps {
  onSelectCore: () => void;
  onSelectSecurity: () => void;
  onStartDemo?: () => void;
  /** Optional slot for a host-supplied region switcher (Shuffle Security renders one; the standalone library does not). */
  regionSwitcher?: ReactNode;
}

const styles = {
  shell: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 24px',
    boxSizing: 'border-box' as const,
  },
  inner: {
    width: '100%',
    maxWidth: 896,
  },
  header: {
    marginBottom: 48,
    textAlign: 'center' as const,
  },
  eyebrow: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'hsl(var(--primary))',
  },
  title: {
    margin: '0 0 16px',
    fontSize: 'clamp(36px, 5vw, 48px)',
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: 0,
    color: 'hsl(var(--foreground))',
  },
  subtitle: {
    margin: '0 auto',
    maxWidth: 576,
    fontSize: 16,
    lineHeight: 1.6,
    color: 'hsl(var(--muted-foreground))',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: 16,
  },
  card: {
    width: '100%',
    minHeight: 236,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    borderRadius: 12,
    border: '1px solid hsl(var(--border))',
    background: 'transparent',
    color: 'hsl(var(--foreground))',
    padding: 24,
    textAlign: 'left' as const,
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
    appearance: 'none' as const,
    font: 'inherit',
    transition: 'border-color 160ms ease, background-color 160ms ease, transform 160ms ease',
  },
  iconWrap: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    flex: '0 0 auto',
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: 0,
    color: 'hsl(var(--foreground))',
  },
  cardText: {
    margin: '0 0 16px',
    flex: 1,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'hsl(var(--muted-foreground))',
  },
  cardCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4,
    color: 'hsl(var(--primary))',
  },
  demoWrap: {
    marginTop: 32,
    display: 'flex',
    justifyContent: 'center',
  },
  demoButton: {
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: 0,
    borderRadius: 999,
    background: 'hsl(var(--primary))',
    color: 'hsl(var(--primary-foreground))',
    padding: '0 24px',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    appearance: 'none' as const,
    boxShadow: '0 10px 24px hsl(var(--primary) / 0.22)',
    transition: 'filter 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  },
  regionWrap: {
    marginTop: 24,
  },
};

const hoverHandlers = {
  onMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.borderColor = 'hsl(var(--primary))';
    event.currentTarget.style.backgroundColor = 'hsl(var(--card) / 0.4)';
    event.currentTarget.style.transform = 'translateY(-1px)';
  },
  onMouseLeave: (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.borderColor = 'hsl(var(--border))';
    event.currentTarget.style.backgroundColor = 'transparent';
    event.currentTarget.style.transform = 'translateY(0)';
  },
  onFocus: (event: React.FocusEvent<HTMLButtonElement>) => {
    event.currentTarget.style.outline = '2px solid hsl(var(--primary))';
    event.currentTarget.style.outlineOffset = '2px';
  },
  onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
    event.currentTarget.style.outline = 'none';
  },
};

export const ProductChoiceStep = ({ onSelectCore, onSelectSecurity, onStartDemo, regionSwitcher }: ProductChoiceStepProps) => {
  return (
    <div style={styles.shell}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <p style={styles.eyebrow}>Choose how you want to use Shuffle</p>
          <h1 style={styles.title}>What are you here to do?</h1>
          <p style={styles.subtitle}>You always have access to both. Pick the one you want to start with.</p>
        </div>

        <div style={styles.grid}>
          <button type="button" onClick={onSelectSecurity} style={styles.card} {...hoverHandlers}>
            <div style={styles.iconWrap}>
              <AgentIcon size={40} />
            </div>
            <h2 style={styles.cardTitle}>Incidents and host monitoring</h2>
            <p style={styles.cardText}>
              Shuffle Security handles the heavy lifting across incidents, hosts and vulnerabilities. You stay in control, because every automation is a workflow you can inspect and edit.
            </p>
            <span style={styles.cardCta}>
              Continue with Shuffle Security
              <ArrowRight size={16} />
            </span>
          </button>

          <button type="button" onClick={onSelectCore} style={styles.card} {...hoverHandlers}>
            <div style={styles.iconWrap}>
              <img src={shuffleInfraLogo} alt="Shuffle Core" width={40} height={40} style={{ borderRadius: 6 }} />
            </div>
            <h2 style={styles.cardTitle}>Manual workflow and app building</h2>
            <p style={styles.cardText}>
              Shuffle Core. The original Shuffle. Build workflows, integrate 3,000+ apps, run AI agents and automate any process across your stack.
            </p>
            <span style={styles.cardCta}>
              Continue with Shuffle Core
              <ArrowRight size={16} />
            </span>
          </button>
        </div>

        {onStartDemo && (
          <div style={styles.demoWrap}>
            <motion.button
              layoutId="onboarding-demo-cta"
              type="button"
              onClick={onStartDemo}
              style={styles.demoButton}
              onMouseEnter={(event) => {
                event.currentTarget.style.filter = 'brightness(1.08)';
                event.currentTarget.style.boxShadow = '0 12px 30px hsl(var(--primary) / 0.28)';
                event.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.filter = 'none';
                event.currentTarget.style.boxShadow = '0 10px 24px hsl(var(--primary) / 0.22)';
                event.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <PlayCircle size={16} />
              Try it immediately — Start Demo Mode
              <ArrowRight size={16} />
            </motion.button>
          </div>
        )}

        {regionSwitcher && <div style={styles.regionWrap}>{regionSwitcher}</div>}
      </div>
    </div>
  );
};

export default ProductChoiceStep;