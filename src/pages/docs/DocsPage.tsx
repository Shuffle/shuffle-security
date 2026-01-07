import { useParams } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';

const DocsPage = () => {
  const { slug = 'index' } = useParams<{ slug: string }>();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />
      
      {/* Spacer for fixed navbar */}
      <Box sx={{ height: 64 }} />
      
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'fixed',
            top: 64,
            left: 0,
            height: 'calc(100vh - 64px)',
            width: 280,
            backgroundColor: 'background.default',
            zIndex: 1,
          }}
        >
          <DocsSidebar />
        </Box>

        {/* Main content */}
        <Box
          sx={{
            flex: 1,
            ml: { xs: 0, md: '280px' },
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Container maxWidth="lg" sx={{ py: 6 }}>
            <MarkdownRenderer slug={slug} />
          </Container>
        </Box>
      </Box>
    </Box>
  );
};

export default DocsPage;
