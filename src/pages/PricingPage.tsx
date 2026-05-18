import React from 'react';
import PricingPageRaw from '@/Shuffle-Core/views/PricingPage';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/context/AuthContext';

const PricingPage: React.FC = () => {
  const theme = useTheme();
  const { isAuthenticated, isLoading, userInfo } = useAuth();
  return (
    // @ts-expect-error — legacy PricingPage props are loosely typed
    <PricingPageRaw
      theme={theme}
      stripeKey={undefined}
      serverside={false}
      isLoaded={!isLoading}
      isLoggedIn={isAuthenticated}
      userdata={userInfo}
      globalUrl={typeof window !== 'undefined' ? window.location.origin : ''}
    />
  );
};

export default PricingPage;
