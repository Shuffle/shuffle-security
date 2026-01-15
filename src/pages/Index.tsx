import { Box } from '@mui/material';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';

const Index = () => {
  return (
    <Box sx={{ minHeight: '100vh', background: 'hsl(var(--background))' }}>
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </Box>
  );
};

export default Index;
