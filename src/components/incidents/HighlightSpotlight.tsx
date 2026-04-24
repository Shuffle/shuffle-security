/**
 * HighlightSpotlight — a lightweight, deep-link-driven spotlight for guiding
 * users from anywhere in the app to a specific button on a destination page.
 *
 * Activated by a `?highlight=<key>` query param (e.g. `/incidents?highlight=ingest`).
 * Mirrors the visual treatment of the demo tour spotlight (dim backdrop +
 * pulsing ring) so the affordance feels familiar, but is independent of demo
 * state so it works for real users coming from dashboard CTAs.
 *
 * Auto-clears the param after the first interaction with the highlighted
 * element (or after 12s) so refreshing does not re-trigger the highlight.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface HighlightTarget {
  selector: string;
  /** Maximum time (ms) the spotlight stays active. Default 12000. */
  maxDurationMs?: number;
}

const HIGHLIGHT_TARGETS: Record<string, HighlightTarget> = {
  ingest: { selector: '[data-tour="add-ingestion-source-button"]' },
};

const PADDING = 8;
const Z_BASE = 1290;

export const HighlightSpotlight = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightKey = searchParams.get('highlight');
  const target = highlightKey ? HIGHLIGHT_TARGETS[highlightKey] : null;

  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(false);

  // Activate when the param is present, deactivate (and strip the param) on
  // user interaction with the target or after a timeout.
  useEffect(() => {
    if (!target) {
      setActive(false);
      return;
    }
    setActive(true);
    const max = target.maxDurationMs ?? 12000;
    const timeout = window.setTimeout(() => clear(), max);

    const clear = () => {
      setActive(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      }, { replace: true });
      window.clearTimeout(timeout);
    };

    // Dismiss on click anywhere — the user has seen the cue.
    const onClick = () => window.setTimeout(clear, 200);
    window.addEventListener('click', onClick, { once: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('click', onClick);
    };
  }, [highlightKey, target, setSearchParams]);

  // Track the target element's bounding rect (poll because it may mount async).
  useEffect(() => {
    if (!active || !target) {
      setRect(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = document.querySelector(target.selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect((prev) => {
            if (
              prev &&
              Math.abs(prev.left - r.left) < 1 &&
              Math.abs(prev.top - r.top) < 1 &&
              Math.abs(prev.width - r.width) < 1 &&
              Math.abs(prev.height - r.height) < 1
            ) {
              return prev;
            }
            return r;
          });
        } else {
          setRect(null);
        }
      } else {
        setRect(null);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, target]);

  // Scroll target into view once when it first appears.
  useEffect(() => {
    if (!active || !target) return;
    const el = document.querySelector(target.selector) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [active, target]);

  if (!active || !rect) return null;

  const x = rect.left - PADDING;
  const y = rect.top - PADDING;
  const w = rect.width + PADDING * 2;
  const h = rect.height + PADDING * 2;
  const radius = 10;

  return (
    <>
      <svg
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: Z_BASE,
          pointerEvents: 'none',
          transition: 'all 120ms ease-out',
        }}
      >
        <defs>
          <mask id="highlight-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={radius} ry={radius} fill="black" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="hsl(0 0% 0%)"
          fillOpacity={0.18}
          mask="url(#highlight-spotlight-mask)"
        />
      </svg>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: radius,
          zIndex: Z_BASE + 1,
          pointerEvents: 'none',
          animation: 'highlight-spotlight-pulse 1.6s ease-in-out infinite',
          transition: 'left 160ms ease-out, top 160ms ease-out, width 160ms ease-out, height 160ms ease-out',
        }}
      />

      <style>{`
        @keyframes highlight-spotlight-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 3px hsl(var(--primary)),
              0 0 0 6px hsl(var(--primary) / 0.35),
              0 0 22px 4px hsl(var(--primary) / 0.45);
          }
          50% {
            box-shadow:
              0 0 0 3px hsl(var(--primary)),
              0 0 0 14px hsl(var(--primary) / 0.10),
              0 0 36px 10px hsl(var(--primary) / 0.55);
          }
        }
      `}</style>
    </>
  );
};

export default HighlightSpotlight;
