import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Chip, Button, Paper, IconButton, Tooltip } from '@mui/material';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, Plus, RefreshCw, Search, Monitor, Users } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';

const VulnerabilitiesPage = () => {
  usePageMeta({ title: 'Vulnerabilities', description: 'Track and manage vulnerabilities across assets and users' });
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'users' ? 'users' : 'assets';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'users' || tab === 'assets') setActiveTab(tab);
  }, [searchParams]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Shield size={28} style={{ color: 'hsl(var(--primary))' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Vulnerabilities
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Track and manage vulnerabilities across your assets and users
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            size="small"
            sx={{
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': { backgroundColor: 'hsl(var(--primary) / 0.9)' },
            }}
          >
            Add Source
          </Button>
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
        {[
          { label: 'Critical', count: 0, color: 'hsl(var(--severity-critical, 0 84% 60%))' },
          { label: 'High', count: 0, color: 'hsl(var(--severity-high, 25 95% 53%))' },
          { label: 'Medium', count: 0, color: 'hsl(var(--severity-medium, 45 93% 47%))' },
          { label: 'Low', count: 0, color: 'hsl(var(--severity-low, 142 76% 36%))' },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
            }}
          >
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 0.5 }}>
              {stat.label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>
              {stat.count}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="assets" className="gap-1.5">
            <Monitor size={14} />
            Assets
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users size={14} />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Paper
            elevation={0}
            sx={{
              p: 6,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              textAlign: 'center',
            }}
          >
            <Monitor size={48} style={{ color: 'hsl(var(--muted-foreground))', margin: '0 auto 16px', opacity: 0.5 }} />
            <Typography variant="h6" sx={{ color: 'hsl(var(--foreground))', mb: 1 }}>
              No assets tracked yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3, maxWidth: 480, mx: 'auto' }}>
              Connect a vulnerability scanner or import assets to start tracking vulnerabilities across your infrastructure.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Plus size={16} />}
              size="small"
              sx={{
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': { backgroundColor: 'hsl(var(--muted))' },
              }}
            >
              Connect Scanner
            </Button>
          </Paper>
        </TabsContent>

        <TabsContent value="users">
          <Paper
            elevation={0}
            sx={{
              p: 6,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              textAlign: 'center',
            }}
          >
            <Users size={48} style={{ color: 'hsl(var(--muted-foreground))', margin: '0 auto 16px', opacity: 0.5 }} />
            <Typography variant="h6" sx={{ color: 'hsl(var(--foreground))', mb: 1 }}>
              No user vulnerabilities found
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3, maxWidth: 480, mx: 'auto' }}>
              Set up automation to check identity platforms for compromised credentials, excessive permissions, and other user-related vulnerabilities.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Plus size={16} />}
              size="small"
              sx={{
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': { backgroundColor: 'hsl(var(--muted))' },
              }}
            >
              Set Up Automation
            </Button>
          </Paper>
        </TabsContent>
      </Tabs>
    </Box>
  );
};

export default VulnerabilitiesPage;
