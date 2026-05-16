import { useNavigate } from 'react-router-dom';
import { OnboardingFlow } from '@/Shuffle-Core/onboarding/OnboardingFlow';

/**
 * Shuffle Security wrapper around the shared Shuffle-Core onboarding flow.
 * The flow itself lives in src/Shuffle-Core/onboarding/ and is shared with
 * Shuffle Core (shuffler.io). This wrapper just tells it which product we are.
 */
const OnboardingPage = () => {
  const navigate = useNavigate();
  return (
    <OnboardingFlow
      product="security"
      coreRedirectUrl="https://shuffler.io/welcome"
      securityRedirectUrl="https://security.shuffler.io/onboarding"
      // We are inside Shuffle Security — start the demo right here instead of
      // round-tripping through a full page reload.
      onStartDemo={() => navigate('/dashboard?demo=true')}
    />
  );
};

export default OnboardingPage;
