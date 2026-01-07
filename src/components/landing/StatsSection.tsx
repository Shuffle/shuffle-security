import { Box, Container, Typography, Grid } from '@mui/material';
import { motion } from 'framer-motion';

const stats = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '50K+', label: 'Alerts Processed Daily' },
  { value: '85%', label: 'Faster Response Time' },
  { value: '200+', label: 'Enterprise Customers' },
];

export const StatsSection = () => {
  return (
    <Box
      sx={{
        py: 10,
        background: 'linear-gradient(180deg, rgba(34, 184, 207, 0.05) 0%, transparent 100%)',
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {stats.map((stat, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '2.5rem', md: '3.5rem' },
                      background: 'linear-gradient(135deg, #22b8cf 0%, #0ea5e9 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 1,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ color: 'text.secondary', fontWeight: 500 }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};
