import { OnboardingFlow } from '@/Shuffle-Core/onboarding/OnboardingFlow';

/**
 * Shuffle Security wrapper around the shared Shuffle-Core onboarding flow.
 * The flow itself lives in src/Shuffle-Core/onboarding/ and is shared with
 * Shuffle Core (shuffler.io). This wrapper just tells it which product we are.
 */
const OnboardingPage = () => (
  <OnboardingFlow
    product="security"
    coreRedirectUrl="https://shuffler.io/welcome"
    securityRedirectUrl="https://security.shuffler.io/onboarding"
  />
);

export default OnboardingPage;
