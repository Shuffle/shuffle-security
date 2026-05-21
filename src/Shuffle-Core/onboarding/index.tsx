/**
 * Onboarding public surface.
 *
 * Every export here is wrapped in `ShuffleCoreThemeProvider` so the onboarding
 * pages ENFORCE Shuffle Core theming (HSL tokens, MUI defaults, scoped portals)
 * regardless of where the host app mounts them. Do NOT bypass by importing the
 * raw files (`./OnboardingFlow`, `./ProductChoiceStep`) directly — go through
 * this index so theme/sizing is guaranteed.
 *
 * Accepts an optional `theme` prop on each component:
 *   - `"light"` / `"dark"` — pin the subtree
 *   - `"system"` (default) — follow the host page's `.dark` class on <html>
 */
import React from 'react';
import {
  ShuffleCoreThemeProvider,
  type ShuffleColorMode,
} from '@/Shuffle-Core/components/ShuffleCoreThemeProvider';

import {
  OnboardingFlow as OnboardingFlowRaw,
  default as OnboardingFlowDefault,
} from './OnboardingFlow';
import { ProductChoiceStep as ProductChoiceStepRaw } from './ProductChoiceStep';

export type ShuffleTheme = 'light' | 'dark' | 'system';
type WithTheme<P> = P & { theme?: ShuffleTheme; colorMode?: ShuffleColorMode };

const resolveMode = (
  theme?: ShuffleTheme,
  colorMode?: ShuffleColorMode,
): ShuffleColorMode => {
  if (theme === 'light' || theme === 'dark') return theme;
  if (theme === 'system') return 'auto';
  return colorMode ?? 'auto';
};

const withTheme = <P extends object>(
  Inner: React.ComponentType<P>,
  displayName: string,
) => {
  const Wrapped: React.FC<WithTheme<P>> = ({ theme, colorMode, ...rest }) => (
    <ShuffleCoreThemeProvider mode={resolveMode(theme, colorMode)}>
      <Inner {...(rest as P)} />
    </ShuffleCoreThemeProvider>
  );
  Wrapped.displayName = `ShuffleCoreOnboarding(${displayName})`;
  return Wrapped;
};

export const OnboardingFlow = withTheme(OnboardingFlowRaw, 'OnboardingFlow');
export const ProductChoiceStep = withTheme(ProductChoiceStepRaw, 'ProductChoiceStep');

export default OnboardingFlow;

export type { OnboardingFlowProps, OnboardingProduct } from './OnboardingFlow';
