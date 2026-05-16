import { OnboardingFlow } from '@/Shuffle-Core/onboarding/OnboardingFlow';
import { useDemo } from '@/context/DemoContext';

/**
 * Shuffle Security wrapper around the shared Shuffle-Core onboarding flow.
 * The flow itself lives in src/Shuffle-Core/onboarding/ and is shared with
 * Shuffle Core (shuffler.io). This wrapper just tells it which product we are.
 */
const OnboardingPage = () => {
  const { startDemo } = useDemo();
  return (
    <OnboardingFlow
      product="security"
      coreRedirectUrl="https://shuffler.io/welcome"
      securityRedirectUrl="https://security.shuffler.io/onboarding"
      // We are already inside Shuffle Security — kick off the demo drawer in
      // place instead of round-tripping through /dashboard?demo=true.
      onStartDemo={() => { startDemo().catch(() => { /* surfaced via toast */ }); }}
    />
  );
};

export default OnboardingPage;
