import { Box, Container, Typography, Grid, Link as MuiLink, Stack, IconButton } from '@mui/material';
import { Link } from 'react-router-dom';
import SecurityIcon from '@mui/icons-material/Security';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Integrations', 'Changelog'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
  Resources: ['Documentation', 'API Reference', 'Community', 'Support'],
  Legal: ['Privacy', 'Terms', 'Security', 'Compliance'],
};

export const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 8,
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        background: 'linear-gradient(180deg, transparent 0%, rgba(12, 18, 34, 0.5) 100%)',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={8}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SecurityIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #22b8cf 0%, #0ea5e9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SecureOps
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 280 }}>
              Empowering security teams with intelligent incident response and collaboration tools.
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <GitHubIcon />
              </IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <LinkedInIcon />
              </IconButton>
              <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <TwitterIcon />
              </IconButton>
            </Stack>
          </Grid>

          {Object.entries(footerLinks).map(([category, links]) => (
            <Grid size={{ xs: 6, sm: 3, md: 2 }} key={category}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                {category}
              </Typography>
              <Stack spacing={1.5}>
                {links.map((link) => (
                  <MuiLink
                    key={link}
                    component={Link}
                    to="#"
                    sx={{
                      color: 'text.secondary',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      transition: 'color 0.2s',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    {link}
                  </MuiLink>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            mt: 8,
            pt: 4,
            borderTop: '1px solid rgba(148, 163, 184, 0.1)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            © 2026 SecureOps. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={3}>
            <MuiLink href="#" sx={{ color: 'text.secondary', fontSize: '0.875rem', textDecoration: 'none' }}>
              Privacy Policy
            </MuiLink>
            <MuiLink href="#" sx={{ color: 'text.secondary', fontSize: '0.875rem', textDecoration: 'none' }}>
              Terms of Service
            </MuiLink>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};
