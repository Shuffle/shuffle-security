import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export const CTASection = () => {
  return (
    <Box sx={{ py: 15 }}>
      <Container maxWidth="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Box
            sx={{
              textAlign: 'center',
              p: { xs: 4, md: 8 },
              borderRadius: 4,
              background: 'linear-gradient(145deg, rgba(255, 102, 0, 0.1) 0%, rgba(255, 133, 51, 0.05) 100%)',
              border: '1px solid rgba(255, 102, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glow effect */}
            <Box
              sx={{
                position: 'absolute',
                top: '-50%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(ellipse at center, rgba(255, 102, 0, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none',
              }}
            />

            <Typography
              variant="h3"
              sx={{
                mb: 2,
                fontWeight: 700,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                position: 'relative',
              }}
            >
              Ready for Automatic Security You Can Trust?
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                mb: 4,
                fontWeight: 400,
                maxWidth: 550,
                mx: 'auto',
                position: 'relative',
              }}
            >
              Automated incident response that reaches everywhere—cloud, on-prem, or hybrid—with complete control over every action.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ position: 'relative' }}
            >
              <Button
                component={Link}
                to="/login"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{ py: 1.5, px: 4 }}
              >
                Get Started
              </Button>
              <Button
                component="a"
                href="https://shuffler.io/contact"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="large"
                sx={{ py: 1.5, px: 4 }}
              >
                Contact Sales
              </Button>
            </Stack>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};
