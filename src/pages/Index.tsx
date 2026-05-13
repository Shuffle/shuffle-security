import { Box } from '@mui/material';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { usePageMeta } from '@/hooks/usePageMeta';

const Index = () => {
  usePageMeta({
    title: 'Shuffle Security — Open Source Alert & Case Management',
    description: 'Open-source AI-powered incident response platform with 3,000+ integrations. Automatic security you control — cloud, on-prem, hybrid.',
    url: '/',
  });
  return (
    <Box sx={{ minHeight: '100vh', background: 'hsl(var(--background))' }}>
      <LandingNavbar />
      <Box component="main">
        <HeroSection />
        <FeaturesSection />
        <CTASection />
      </Box>
      <Footer />
    </Box>
  );
};

export default Index;
