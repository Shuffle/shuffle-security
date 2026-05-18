import React from 'react';
import PricingPageRaw from '@/Shuffle-Core/views/PricingPage';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/context/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

const PricingPage: React.FC = () => {
  const theme = useTheme();
  const { isAuthenticated, isLoading, userInfo } = useAuth();

  return (
    <>
      <LandingNavbar />
      <div style={{ paddingTop: 96 }}>
        <PricingPageRaw
          theme={theme}
          stripeKey={undefined}
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
