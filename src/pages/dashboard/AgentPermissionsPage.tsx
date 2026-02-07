import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
  Collapse,
  Alert,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  Radar,
  Zap,
  Bell,
  Server,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { useAgentPermissions, RiskLevel, AgentPermissionCategory } from '@/hooks/useAgentPermissions';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Radar: <Radar size={20} />,
  Zap: <Zap size={20} />,
  Bell: <Bell size={20} />,
  Server: <Server size={20} />,
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  low: {
    label: 'Low Risk',
    color: 'hsl(142, 71%, 45%)',
    bg: 'rgba(34, 197, 94, 0.1)',
    icon: <ShieldCheck size={14} />,
  },
  medium: {
    label: 'Medium Risk',
    color: 'hsl(45, 93%, 47%)',
    bg: 'rgba(234, 179, 8, 0.1)',
    icon: <ShieldAlert size={14} />,
  },
  high: {
    label: 'High Risk',
    color: 'hsl(0, 84%, 60%)',
    bg: 'rgba(239, 68, 68, 0.1)',
    icon: <ShieldOff size={14} />,
  },
};

const AgentPermissionsPage = () => {
  const {
    categories,
    isLoading,
    isSaving,
    error,
    totalPermissions,
    enabledPermissions,
    togglePermission,
    toggleCategory,
    resetToDefaults,
  } = useAgentPermissions();

  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    () => categories.map(c => c.id)
  );

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getCategoryStats = (cat: AgentPermissionCategory) => {
    const enabled = cat.permissions.filter(p => p.enabled).length;
    const total = cat.permissions.length;
    return { enabled, total, allEnabled: enabled === total, noneEnabled: enabled === 0 };
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Box sx={{ p: 4, maxWidth: 900 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Agent Permissions
              </Typography>
              {isSaving && <CircularProgress size={18} sx={{ color: 'hsl(var(--primary))' }} />}
            </Box>
            <Tooltip title="Reset all permissions to defaults">
              <Button
                variant="outlined"
                size="small"
                startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
                onClick={resetToDefaults}
                sx={{
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--muted-foreground))',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary))',
                  },
                }}
              >
                Reset to Defaults
              </Button>
            </Tooltip>
          </Box>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 2 }}>
            Control what actions your AI agent can perform across your security stack.
          </Typography>

          {/* Summary bar */}
          <Paper
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Enabled
            </Typography>
            <Chip
              label={`${enabledPermissions}/${totalPermissions}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: enabledPermissions === totalPermissions
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(255, 102, 0, 0.15)',
                color: enabledPermissions === totalPermissions
                  ? 'hsl(142, 71%, 45%)'
                  : 'hsl(var(--primary))',
              }}
            />
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              {(['low', 'medium', 'high'] as RiskLevel[]).map(risk => {
                const cfg = RISK_CONFIG[risk];
                const count = categories.reduce(
                  (sum, cat) => sum + cat.permissions.filter(p => p.risk === risk).length,
                  0
                );
                return (
                  <Chip
                    key={risk}
                    icon={<span style={{ display: 'flex', color: cfg.color }}>{cfg.icon}</span>}
                    label={`${count} ${cfg.label.split(' ')[0]}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: cfg.color + '40',
                      color: cfg.color,
                      fontSize: '0.7rem',
                    }}
                  />
                );
              })}
            </Box>
          </Paper>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}

        {/* Category sections */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AnimatePresence>
            {categories.map((cat) => {
              const stats = getCategoryStats(cat);
              const isExpanded = expandedCategories.includes(cat.id);

              return (
                <motion.div
                  key={cat.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Paper
                    sx={{
                      bgcolor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Category header */}
                    <Box
                      sx={{
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'hsl(var(--muted) / 0.3)' },
                      }}
                      onClick={() => toggleExpand(cat.id)}
                    >
                      <Box sx={{ color: 'hsl(var(--primary))', display: 'flex' }}>
                        {CATEGORY_ICONS[cat.icon] || <Server size={20} />}
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
                        {cat.label}
                      </Typography>
                      <Chip
                        label={`${stats.enabled}/${stats.total}`}
                        size="small"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          bgcolor: stats.allEnabled
                            ? 'rgba(34, 197, 94, 0.12)'
                            : stats.noneEnabled
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(255, 102, 0, 0.12)',
                          color: stats.allEnabled
                            ? 'hsl(142, 71%, 45%)'
                            : stats.noneEnabled
                            ? 'hsl(0, 84%, 60%)'
                            : 'hsl(var(--primary))',
                        }}
                      />
                      <Tooltip title={stats.allEnabled ? 'Disable all' : 'Enable all'}>
                        <Switch
                          size="small"
                          checked={stats.allEnabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCategory(cat.id, !stats.allEnabled);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: 'hsl(var(--primary))',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              bgcolor: 'hsl(var(--primary))',
                            },
                          }}
                        />
                      </Tooltip>
                      <IconButton size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Box>

                    {/* Permission items */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ borderTop: '1px solid hsl(var(--border))' }}>
                        {cat.permissions.map((perm, idx) => {
                          const riskCfg = RISK_CONFIG[perm.risk];
                          return (
                            <Box
                              key={perm.id}
                              sx={{
                                px: 3,
                                py: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                borderBottom: idx < cat.permissions.length - 1
                                  ? '1px solid hsl(var(--border) / 0.5)'
                                  : 'none',
                                opacity: perm.enabled ? 1 : 0.55,
                                transition: 'opacity 0.2s',
                                '&:hover': {
                                  bgcolor: 'hsl(var(--muted) / 0.2)',
                                },
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      color: 'hsl(var(--foreground))',
                                    }}
                                  >
                                    {perm.name}
                                  </Typography>
                                  <Chip
                                    icon={<span style={{ display: 'flex', color: riskCfg.color }}>{riskCfg.icon}</span>}
                                    label={perm.risk}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.65rem',
                                      fontWeight: 500,
                                      bgcolor: riskCfg.bg,
                                      color: riskCfg.color,
                                      textTransform: 'capitalize',
                                      '& .MuiChip-icon': { ml: 0.5 },
                                    }}
                                  />
                                </Box>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'hsl(var(--muted-foreground))' }}
                                >
                                  {perm.description}
                                </Typography>
                              </Box>
                              <Switch
                                size="small"
                                checked={perm.enabled}
                                onChange={() => togglePermission(cat.id, perm.id)}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: perm.risk === 'high' ? riskCfg.color : 'hsl(var(--primary))',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    bgcolor: perm.risk === 'high' ? riskCfg.color : 'hsl(var(--primary))',
                                  },
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Paper>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </Box>
      </Box>
    </motion.div>
  );
};

export default AgentPermissionsPage;
