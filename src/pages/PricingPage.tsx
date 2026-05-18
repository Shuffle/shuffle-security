import React from 'react';
import PricingPageRaw from '@/Shuffle-Core/views/PricingPage';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/context/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

const PricingPage: React.FC = () => {
  const theme = useTheme();
  const { isAuthenticated, isLoading, userInfo } = useAuth();

  const origin = typeof window === 'undefined' || window.location === undefined ? '' : window.location.origin;
  const isLiveStripeOrigin = origin === 'https://shuffler.io' || origin === 'https://security.shuffler.io';
  const stripeKey = isLiveStripeOrigin
    ? 'pk_live_51PXYYMEJjT17t98N20qEqItyt1fLQjrnn41lPeG2PjnSlZHTDNKHuisAbW00s4KAn86nGuqB9uSVU4ds8MutbnMU00DPXpZ8ZD'
    : 'pk_test_51PXYYMEJjT17t98NbDkojZ3DRvsFUQBs35LGMx3i436BXwEBVFKB9nCvHt0Q3M4MG3dz4mHheuWvfoYvpaL3GmsG00k1Rb2ksO';

  return (
    <>
      <LandingNavbar />
      <div style={{ paddingTop: 96 }}>
        <PricingPageRaw
          theme={theme}
          stripeKey={stripeKey}
          serverside={false}
          isLoaded={!isLoading}
          isLoggedIn={isAuthenticated}
          userdata={userInfo}
          globalUrl={typeof window !== 'undefined' ? window.location.origin : ''}
        />
      </div>
    </>
  );
};

export default PricingPage;
