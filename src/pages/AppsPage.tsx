import { useRef, useState, useEffect } from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Mail, Radar, Search, Globe, Cloud, Shield } from 'lucide-react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Footer } from '@/components/landing/Footer';
import { ShuffleMCP, ShuffleMCPHandle } from '@/Shuffle-MCPs';
import { trackCTA, trackPredefinedEvent, GA_EVENTS } from '@/lib/analytics';
import { usePageMeta } from '@/hooks/usePageMeta';

const categories = [
  { id: 'cloud', label: 'Cloud', icon: Cloud, description: 'AWS, Azure, GCP', searchTerm: 'cloud' },
  { id: 'siem', label: 'SIEM', icon: Radar, description: 'Log aggregation', searchTerm: 'siem' },
  { id: 'email', label: 'Email', icon: Mail, description: 'Inboxes & mail', searchTerm: 'email' },
  { id: 'edr', label: 'EDR', icon: Search, description: 'Endpoint detection', searchTerm: 'edr' },
  { id: 'threat', label: 'Threat Intel', icon: Shield, description: 'IOC enrichment', searchTerm: 'threat intel' },
];

const catchAllCategory = { id: 'other', label: 'Browse All 3,000+ Integrations', icon: Globe, searchTerm: '' };

export default function AppsPage() {
  const singulRef = useRef<ShuffleMCPHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  usePageMeta({
    title: '3,000+ Integrations',
    description: 'Browse and connect 3,000+ security integrations — SIEM, EDR, Email, Cloud, ITSM, Threat Intel and more. Use your existing tools with Shuffle Security.',
    url: '/apps',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '3,000+ Security Integrations',
      description: 'Browse and connect 3,000+ security integrations across SIEM, EDR, Email, Cloud, ITSM, and Threat Intelligence categories.',
      url: 'https://security.shuffler.io/apps',
      isPartOf: { '@type': 'WebSite', name: 'Shuffle Security', url: 'https://security.shuffler.io' },
    },
  });

  // Initialize from URL query param
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search');
    
    if (searchParam) {
      // Direct search query (e.g., from floating icons)
      setSearchQuery(searchParam);
      if (singulRef.current) {
        singulRef.current.search(searchParam);
      }
    } else if (categoryParam) {
      const category = categories.find(c => c.id === categoryParam);
      if (category) {
        setSearchQuery(category.searchTerm);
        if (singulRef.current) {
          singulRef.current.search(category.searchTerm);
        }
      }
    }
  }, []);

  const getActiveCategory = () => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    if (lowerQuery === '') return 'other';
    return categories.find(c => c.searchTerm && lowerQuery.includes(c.searchTerm.toLowerCase()))?.id || null;
  };

  const handleCategoryClick = (categoryId: string, searchTerm: string) => {
    // Toggle off if clicking the same category
    const isAlreadyActive = activeCategory === categoryId;
    const newSearchTerm = isAlreadyActive ? '' : searchTerm;
    
    setSearchQuery(newSearchTerm);
    setSearchParams(newSearchTerm ? { category: categoryId } : {});
    trackPredefinedEvent(GA_EVENTS.CATEGORY_FILTER, isAlreadyActive ? 'clear' : categoryId);
    if (singulRef.current) {
      singulRef.current.search(newSearchTerm);
    }
  };

  const activeCategory = getActiveCategory();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />
      
      {/* Hero section */}
      <Box
        sx={{
          pt: { xs: 12, md: 16 },
          pb: { xs: 4, md: 6 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 80%, rgba(255, 102, 0, 0.08) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  fontWeight: 800,
                  mb: 3,
                  letterSpacing: '-0.02em',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  3,000+
                </Box>{' '}
                Integrations
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: 'text.secondary',
                  maxWidth: 650,
                  mx: 'auto',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                  mb: 4,
                }}
              >
                Connect your SIEM, EDR, ITSM, Email, Threat Intel, Cloud, and any other data source. 
                Use your existing tools—we fill in the gaps.
              </Typography>
              <Button
                component={Link}
                to="/register"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => trackCTA('get_started_free', 'apps_hero')}
                sx={{
                  py: { xs: 1.25, md: 1.5 },
                  px: { xs: 3, md: 4 },
                  fontSize: { xs: '0.9rem', md: '1rem' },
                  fontWeight: 600,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  boxShadow: '0 8px 32px rgba(255, 102, 0, 0.35)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(255, 102, 0, 0.45)',
                  },
                }}
              >
                Get Started Free
              </Button>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Category buttons and search section */}
      <Box sx={{ flex: 1, pb: 12 }}>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Category Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
                gap: 2,
                mb: 4,
              }}
            >
              {categories.map((category) => {
                const isActive = activeCategory === category.id;
                return (
                  <Box
                    key={category.id}
                    sx={{
                      p: 2.5,
                      backgroundColor: isActive ? 'rgba(255, 102, 0, 0.1)' : 'action.hover',
                      border: '1px solid',
                      borderColor: isActive ? 'primary.main' : 'divider',
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      textAlign: 'center',
                      '&:hover': {
                        borderColor: 'rgba(255, 102, 0, 0.5)',
                        backgroundColor: isActive ? 'rgba(255, 102, 0, 0.15)' : 'action.selected',
                      },
                    }}
                    onClick={() => handleCategoryClick(category.id, category.searchTerm)}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: isActive ? 'rgba(255, 102, 0, 0.2)' : 'action.hover',
                        border: '2px solid',
                        borderColor: isActive ? 'primary.main' : 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <category.icon size={18} color={isActive ? '#FF6600' : undefined} />
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: 'text.primary', fontWeight: 600, mb: 0.25 }}
                    >
                      {category.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}
                    >
                      {category.description}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Singul Search Component */}
            <Box
              sx={{
                '--singul-input-bg': 'hsl(var(--input))',
                '--singul-input-border': '1px solid hsl(var(--border))',
                '--singul-input-color': 'hsl(var(--foreground))',
                '--singul-input-focus-border': 'hsl(var(--primary))',
                '--singul-input-focus-shadow': '0 0 0 3px hsla(var(--primary) / 0.15)',
                '--singul-placeholder-color': 'hsl(var(--muted-foreground))',
                '--singul-icon-color': 'hsl(var(--muted-foreground))',
                '--singul-dropdown-bg': 'hsl(var(--background))',
                '--singul-dropdown-border': '1px solid hsl(var(--border))',
                '--singul-item-border': '1px solid hsl(var(--border-subtle))',
                '--singul-item-hover-bg': 'rgba(255, 102, 0, 0.1)',
                '--singul-app-name-color': 'hsl(var(--foreground))',
                '--singul-app-description-color': 'hsl(var(--muted-foreground))',
                '--singul-empty-state-color': 'hsl(var(--muted-foreground))',
                '--singul-grid-gap': '16px',
                '& .singul-results-container': {
                  maxHeight: '600px',
                  mt: 3,
                },
                '& .singul-results-grid': {
                  display: 'grid !important',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr) !important',
                    sm: 'repeat(2, 1fr) !important',
                    md: 'repeat(3, 1fr) !important',
                  },
                  gap: { xs: '12px !important', md: '16px !important' },
                },
                '& .singul-dropdown-item': {
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 102, 0, 0.08)',
                    borderColor: 'rgba(255, 102, 0, 0.3)',
                  },
                },
                '& .singul-search-input': {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: { xs: '0.9rem', md: '1rem' },
                  padding: { xs: '12px 14px', md: '14px 16px' },
                  borderRadius: '12px',
                  '&:focus': {
                    borderColor: '#FF6600',
                    boxShadow: '0 0 0 3px rgba(255, 102, 0, 0.15)',
                  },
                  '&::placeholder': {
                    color: 'rgba(255, 255, 255, 0.4)',
                  },
                },
                '& .singul-app-icon': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                '& .singul-app-name': {
                  color: '#ffffff',
                  fontSize: { xs: '0.8rem', md: '0.9rem' },
                },
                '& .singul-app-description': {
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                },
                '& .singul-empty-state, & .singul-end-of-results': {
                  color: 'rgba(255, 255, 255, 0.4)',
                },
              }}
            >
              <ShuffleMCP
                ref={singulRef}
                placeholder="Search integrations... (e.g., Splunk, CrowdStrike)"
                layout="grid"
                gridColumns={3}
                showDescription
                inline
                hitsPerPage={28}
                preventDefault
                hideAuthStatus
                initialQuery={searchQuery}
                onSearchChange={(query) => {
                  setSearchQuery(query);
                  if (query.length > 2) {
                    trackPredefinedEvent(GA_EVENTS.SEARCH_USED, query);
                  }
                }}
                onAppSelected={({ app }) => {
                  trackPredefinedEvent(GA_EVENTS.APP_VIEWED, app.name);
                  navigate(`/apps/${encodeURIComponent(app.name.toLowerCase().replace(/[\s]+/g, '_'))}`);
                }}
              />
            </Box>
          </motion.div>

          {/* CTA at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.1rem',
                  mb: 3,
                }}
              >
                Can't find what you need? We support any REST API or Python function.
              </Typography>
              <Button
                component={Link}
                to="/register"
                variant="outlined"
                size="large"
                onClick={() => trackCTA('start_building', 'apps_bottom')}
                sx={{
                  py: { xs: 1.25, md: 1.5 },
                  px: { xs: 3, md: 4 },
                  fontSize: { xs: '0.9rem', md: '1rem' },
                  fontWeight: 600,
                  borderRadius: 3,
                  borderColor: 'rgba(255, 102, 0, 0.5)',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.main',
                    background: 'rgba(255, 102, 0, 0.08)',
                  },
                }}
              >
                Start Building
              </Button>
            </Box>
          </motion.div>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}