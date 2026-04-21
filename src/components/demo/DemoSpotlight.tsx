/**
 * DemoSpotlight — dim the page with an SVG cutout around the target element
 * and pulse a ring around it. Click-through is enabled inside the cutout so
 * the user can interact with the highlighted element.
 *
 * Why both backdrop + pulse: NN/g onboarding research consistently finds that
 * a dim backdrop directs visual attention while an animated ring provides the
 * affordance ("this is clickable"). Together they outperform either alone.
 */

import { useEffect, useState } from 'react';
import { useDemo, TOUR_STEPS } from '@/context/DemoContext';

const PADDING = 8;
const Z_BASE = 1290; // just below the drawer (1300)

export const DemoSpotlight = () => {
  const { drawerOpen, step, currentStepUnlocked } = useDemo();
  const current = TOUR_STEPS[step];
  const selector = current?.requirement?.targetSelector;

  const [rect, setRect] = useState<DOMRect | null>(null);
  // True when the user has opened a modal/drawer (e.g. AppSearchDrawer) on top
  // of the highlighted target. We hide the spotlight in that case so it does
  // not keep pointing at the now-obscured "+" button.
  const [modalOpen, setModalOpen] = useState(false);

  // Watch for any MUI modal/drawer being mounted into the DOM. The spotlight
  // is hidden whenever one is present so it does not double-up with the
  // surface the user just opened.
  useEffect(() => {
    if (!drawerOpen) {
      setModalOpen(false);
      return;
    }
    const check = () => {
      // Exclude the demo tour drawer itself (it carries a data-demo-tour attr).
      const modals = document.querySelectorAll(
        '.MuiModal-root:not([data-demo-tour]), .MuiDrawer-root:not([data-demo-tour])'
      );
      let found = false;
      modals.forEach((m) => {
        if (found) return;
        const el = m as HTMLElement;
        // MUI keeps modals mounted but hidden; skip those.
        if (el.getAttribute('aria-hidden') === 'true') return;
        if (el.style.visibility === 'hidden' || el.style.display === 'none') return;
        if (el.offsetParent === null && el.getClientRects().length === 0) return;
        found = true;
      });
      setModalOpen(found);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'style'] });
    return () => observer.disconnect();
  }, [drawerOpen]);

  // Find + track the target element. Polls because the DOM may load async.
  useEffect(() => {
    if (!drawerOpen || !selector || currentStepUnlocked || modalOpen) {
      setRect(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        // Skip if the element is offscreen / collapsed
        if (r.width > 0 && r.height > 0) {
          setRect(prev => {
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
  }, [drawerOpen, selector, currentStepUnlocked, modalOpen]);

  // Scroll target into view once when it first appears
  useEffect(() => {
    if (!selector || currentStepUnlocked || modalOpen) return;
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selector, currentStepUnlocked, step, modalOpen]);

  if (!drawerOpen || !rect || currentStepUnlocked || modalOpen) return null;

  const x = rect.left - PADDING;
  const y = rect.top - PADDING;
  const w = rect.width + PADDING * 2;
  const h = rect.height + PADDING * 2;
  const radius = 10;

  // SVG mask: full-screen black, cut a rounded-rect transparent hole.
  // pointerEvents="none" on the SVG lets clicks pass through everywhere,
  // and the visible dim is just visual — the cutout stays interactive.
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
        }}
      >
        <defs>
          <mask id="demo-spotlight-mask">
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
          fillOpacity="0.18"
          mask="url(#demo-spotlight-mask)"
        />
      </svg>

      {/* Pulsing ring — separate so we can animate it */}
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
          boxShadow: '0 0 0 3px hsl(var(--primary)), 0 0 0 8px hsl(var(--primary) / 0.25)',
          animation: 'demo-spotlight-pulse 1.6s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes demo-spotlight-pulse {
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

export default DemoSpotlight;
