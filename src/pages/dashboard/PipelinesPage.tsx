import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select as MuiSelect,
  MenuItem,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import VisibilityIcon from '@mui/icons-material/Visibility';
import StorageIcon from '@mui/icons-material/Storage';
import { toast } from 'sonner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getApiUrl, getAuthHeader, API_CONFIG } from '@/config/api';
import { askAI } from '@/services/ai';

interface Environment {
  id: string;
  Name: string;
  Type: string;
  Registered: boolean;
  archived: boolean;
  org_id: string;
  checkin: number;
  auth: string;
  data_lake?: {
    enabled: boolean;
    pipelines: any;
  };
}

interface Pipeline {
  pipeline: string;
  id?: string;
  name?: string;
  command?: string;
  definition?: string;
  state?: string;
  start_time?: number;
  created?: number;
  // enriched locally
  _environmentId: string;
  _environmentName: string;
}

interface DefaultPipeline {
  label: string;
  description: string;
  command: string;
  hasPlaceholders?: boolean;
  matchKeys: string[]; // keywords to match against deployed pipelines
}

const DEFAULT_PIPELINES: DefaultPipeline[] = [
  {
    label: 'TCP Syslog',
    description: 'Ingest syslog events over TCP on port 1514',
    command: 'load_tcp "0.0.0.0:1514" { read_syslog } | import',
    matchKeys: ['load_tcp', 'syslog', 'tcp'],
  },
  {
    label: 'UDP Syslog',
    description: 'Ingest syslog events over UDP on port 1514',
    command: 'load_udp "0.0.0.0:1514", insert_newlines=true | read_syslog | import',
    matchKeys: ['load_udp', 'udp'],
  },
  {
    label: 'Sigma Rule Alerting',
    description: 'Live export with Sigma rule matching, forwarded to a webhook',
    command: 'export live=true | sigma "/tmp/sigma_rules" | to "http://localhost:5002/api/v1/hooks/webhook_e031c4c0-3f7e-4c0f-a8d2-ff87be206907"',
    hasPlaceholders: true,
    matchKeys: ['sigma', 'sigma_rules'],
  },
  {
    label: 'OpenSearch Forwarder',
    description: 'Forward live events to an OpenSearch instance',
    command: 'export live=true | to_opensearch "localhost:9200", action="create", index="shuffle_logs", user="admin", passwd="PASSWORD"',
    hasPlaceholders: true,
    matchKeys: ['to_opensearch', 'opensearch'],
  },
  {
    label: 'Kafka Subscriber',
    description: 'Subscribe to a Kafka topic and ingest events',
    command: 'from_kafka "localhost:9092", topic="security_events" | import',
    hasPlaceholders: true,
    matchKeys: ['from_kafka', 'kafka'],
  },
  {
    label: 'ZeroMQ Subscriber',
    description: 'Subscribe to a ZeroMQ socket for event ingestion',
    command: 'load_zmq "tcp://localhost:5555" | read_json | import',
    hasPlaceholders: true,
    matchKeys: ['load_zmq', 'zeromq', 'zmq'],
  },
  {
    label: 'File Watcher',
    description: 'Watch a local JSON log file and ingest new entries',
    command: 'load_file "/var/log/events.json", follow=true | read_json | import',
    hasPlaceholders: true,
    matchKeys: ['load_file', 'follow=true'],
  },
  {
    label: 'Velociraptor Import',
    description: 'Ingest Velociraptor hunt results from a file',
    command: 'from_file "/tmp/velociraptor_results.json" | read_json | import',
    hasPlaceholders: true,
    matchKeys: ['velociraptor', 'from_file'],
  },
];

const PipelinesPage = () => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newCommand, setNewCommand] = useState('');
  const [newEnvId, setNewEnvId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);

  // Detail dialog
  const [detailPipeline, setDetailPipeline] = useState<Pipeline | null>(null);

  // Action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Auto-select best environment when create dialog opens
  useEffect(() => {
    if (createOpen && !newEnvId && environments.length > 0) {
      const nonCloud = environments.filter(e => e.Type !== 'cloud');
      const now = Math.floor(Date.now() / 1000);
      const running = nonCloud.find(e => e.checkin > 0 && (now - e.checkin) < 300);
      const first = nonCloud[0];
      setNewEnvId(running?.id || first?.id || '');
    }
  }, [createOpen, environments]);

  const fetchEnvironments = useCallback(async () => {
    if (!API_CONFIG.apiKey) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/v1/getenvironments'), {
        credentials: 'include',
        headers: { ...getAuthHeader() },
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data: Environment[] = await response.json();
      const active = data.filter(e => !e.archived);
      setEnvironments(active);

      // Extract pipelines from all environments
      const allPipelines: Pipeline[] = [];
      for (const env of active) {
        const raw = env.data_lake?.pipelines;
        if (!raw) continue;
        
        // Handle both array and object/map formats
        let pList: any[];
        if (Array.isArray(raw)) {
          pList = raw;
        } else if (typeof raw === 'object') {
          // Could be a map keyed by pipeline ID
          pList = Object.values(raw);
          console.log('[PipelinesPage] data_lake.pipelines is an object, converting values:', pList.length);
        } else {
          console.log('[PipelinesPage] data_lake.pipelines unexpected type:', typeof raw, raw);
          continue;
        }

        console.log(`[PipelinesPage] Env "${env.Name}" has ${pList.length} pipelines`);

        for (const p of pList) {
          if (typeof p === 'string') {
            allPipelines.push({
              pipeline: p,
              definition: p,
              _environmentId: env.id,
              _environmentName: env.Name,
            });
          } else if (p && typeof p === 'object') {
            allPipelines.push({
              ...p,
              pipeline: p.pipeline || p.id || p.name || '',
              _environmentId: env.id,
              _environmentName: env.Name,
            });
          }
        }
      }
      console.log('[PipelinesPage] Total pipelines found:', allPipelines.length);
      setPipelines(allPipelines);
    } catch (error) {
      console.error('Failed to fetch environments:', error);
      toast.error('Failed to load pipelines');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const getStateColor = (state?: string): 'success' | 'error' | 'warning' | 'default' => {
    if (!state) return 'default';
    const s = state.toLowerCase();
    if (s === 'running' || s === 'active' || s === 'started') return 'success';
    if (s === 'stopped' || s === 'failed' || s === 'error') return 'error';
    if (s === 'paused' || s === 'stopping') return 'warning';
    return 'default';
  };

  const getStateLabel = (p: Pipeline): string => {
    if (p.state) return p.state;
    // Infer from start_time
    if (p.start_time && p.start_time > 0) return 'running';
    return 'unknown';
  };

  const getPipelineLabel = (p: Pipeline): string => {
    if (p.name) return p.name;
    const def = p.definition || p.command || p.pipeline || '';
    if (def.length > 60) return def.substring(0, 57) + '...';
    return def || 'Unnamed Pipeline';
  };

  const handleAction = async (pipeline: Pipeline, action: 'start' | 'stop' | 'delete') => {
    const id = pipeline.pipeline || pipeline.id || '';
    setActionLoading(prev => ({ ...prev, [id]: true }));

    try {
      const env = environments.find(e => e.id === pipeline._environmentId);
      const response = await fetch(getApiUrl('/api/v1/triggers/pipeline'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: pipeline.name || pipeline.definition || '',
          id: pipeline.pipeline || pipeline.id || '',
          type: action,
          command: pipeline.definition || pipeline.command || '',
          environment: env?.Name || pipeline._environmentName,
        }),
      });

      if (response.ok) {
        toast.success(`Pipeline ${action === 'delete' ? 'deleted' : action === 'start' ? 'started' : 'stopped'}`);
        // Refresh after a short delay
        setTimeout(() => fetchEnvironments(), 2000);
      } else {
        const text = await response.text();
        toast.error(`Failed to ${action} pipeline: ${text.substring(0, 80)}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing pipeline:`, error);
      toast.error(`Error ${action}ing pipeline`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCreate = async () => {
    if (!newCommand.trim()) {
      toast.error('Enter a pipeline command');
      return;
    }
    if (!newEnvId) {
      toast.error('Select an environment');
      return;
    }

    setIsCreating(true);
    try {
      const env = environments.find(e => e.id === newEnvId);
      const response = await fetch(getApiUrl('/api/v1/triggers/pipeline'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: newCommand,
          name: newCommand,
          type: 'create',
          environment: env?.Name || '',
          workflow_id: '',
          trigger_id: '',
          start_node: '',
        }),
      });

      if (response.ok) {
        toast.success('Pipeline created');
        setCreateOpen(false);
        setNewCommand('');
        setNewEnvId('');
        setTimeout(() => fetchEnvironments(), 2000);
      } else {
        const text = await response.text();
        toast.error(`Failed to create: ${text.substring(0, 80)}`);
      }
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast.error('Error creating pipeline');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateFromAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Describe what you want the pipeline to do');
      return;
    }
    setIsGenerating(true);
    try {
      const { success, result, error } = await askAI({
        query: `Generate a Tenzir pipeline command for the following use case. Only output the pipeline command, no explanation or markdown formatting. Use Tenzir pipeline syntax (operators separated by |). Here are some examples of valid commands:
- load_tcp "0.0.0.0:1514" { read_syslog } | import
- load_udp "0.0.0.0:1514", insert_newlines=true | read_syslog | import
- export live=true | sigma "/tmp/sigma_rules" | to "http://example.com/webhook"
- export live=true | to_opensearch "localhost:9200", action="create", index="shuffle_logs", user="admin", passwd="PASSWORD"

Use case: ${aiPrompt}`,
      });
      if (success && result) {
        const cleaned = result.replace(/^```[^\n]*\n?/i, '').replace(/\n?```$/i, '').trim();
        setNewCommand(cleaned);
        setJustGenerated(true);
        setTimeout(() => setJustGenerated(false), 3000);
        toast.success('Pipeline command generated');
      } else {
        toast.error(error || 'Failed to generate pipeline command');
      }
    } catch (e) {
      console.error('AI generation error:', e);
      toast.error('Failed to generate pipeline command');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  // Filter out templates that match already-deployed pipelines
  const deployedDefs = pipelines.map(p => (p.definition || p.command || p.pipeline || '').toLowerCase());
  const availableTemplates = DEFAULT_PIPELINES.filter(dp =>
    !dp.matchKeys.some(key => deployedDefs.some(def => def.includes(key.toLowerCase())))
  );

  // Filtering
  const uniqueStates = [...new Set(pipelines.map(p => getStateLabel(p)))].sort();
  const uniqueEnvs = [...new Set(pipelines.map(p => p._environmentName))].sort();

  const filtered = pipelines.filter(p => {
    const label = getPipelineLabel(p).toLowerCase();
    const def = (p.definition || p.command || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || label.includes(q) || def.includes(q);
    const matchEnv = envFilter === 'all' || p._environmentName === envFilter;
    const matchState = stateFilter === 'all' || getStateLabel(p) === stateFilter;
    return matchSearch && matchEnv && matchState;
  });

  const isSensorRunning = (envId: string): boolean => {
    const env = environments.find(e => e.id === envId);
    if (!env) return false;
    if (env.Type === 'cloud') return true;
    const now = Math.floor(Date.now() / 1000);
    return env.checkin > 0 && (now - env.checkin) < 300;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <StorageIcon sx={{ color: '#FF6600', fontSize: 28 }} />
            <Typography variant="h5" sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
              Pipeline Controller
            </Typography>
            <Chip
              label="Tenzir"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 102, 0, 0.12)',
                color: '#FF6600',
                border: '1px solid rgba(255, 102, 0, 0.3)',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Lightweight detection infrastructure — ingest, match, and forward security events without heavy tooling
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => { setIsLoading(true); fetchEnvironments(); }}
              size="small"
              sx={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size="small"
            sx={{
              bgcolor: '#FF6600',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { bgcolor: '#e55b00' },
            }}
          >
            New Pipeline
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search pipelines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              height: 36,
              backgroundColor: 'hsl(var(--muted))',
              '& fieldset': { borderColor: 'hsl(var(--border))' },
              '&:hover fieldset': { borderColor: 'hsl(var(--border))' },
              '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
            },
            '& .MuiOutlinedInput-input': {
              color: 'hsl(var(--foreground))',
              '&::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 1 },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />

        <Chip
          label={`${filtered.length} pipeline${filtered.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            height: 24,
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            border: '1px solid hsl(var(--border))',
          }}
        />

        {uniqueEnvs.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Environment</InputLabel>
            <MuiSelect
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              label="Environment"
              sx={{
                height: 36,
                color: 'hsl(var(--foreground))',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              }}
            >
              <MenuItem value="all">All Environments</MenuItem>
              {uniqueEnvs.map(e => (
                <MenuItem key={e} value={e}>{e}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>
        )}

        {uniqueStates.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Status</InputLabel>
            <MuiSelect
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              label="Status"
              sx={{
                height: 36,
                color: 'hsl(var(--foreground))',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              }}
            >
              <MenuItem value="all">All</MenuItem>
              {uniqueStates.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>
        )}
      </Box>



      {/* Table */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress sx={{ color: '#FF6600' }} />
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          py: 4,
          gap: 3,
        }}>
          {/* Templates */}
          {availableTemplates.length > 0 && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
              Templates
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {availableTemplates.map((dp) => (
                <Box
                  key={dp.label}
                  onClick={() => {
                    setNewCommand(dp.command);
                    setCreateOpen(true);
                  }}
                  sx={{
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'rgba(255, 102, 0, 0.4)', backgroundColor: 'rgba(255, 102, 0, 0.04)' },
                  }}
                >
                  <RocketLaunchIcon sx={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
                  <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dp.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          )}
        </Box>
      ) : (
        <Box sx={{
          border: '1px solid hsl(var(--border))',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium text-xs w-[30%]">Pipeline</TableHead>
                <TableHead className="text-muted-foreground font-medium text-xs w-[15%]">Environment</TableHead>
                <TableHead className="text-muted-foreground font-medium text-xs w-[10%]">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium text-xs w-[30%]">Command</TableHead>
                <TableHead className="text-muted-foreground font-medium text-xs w-[15%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p, idx) => {
                const id = p.pipeline || p.id || `p-${idx}`;
                const state = getStateLabel(p);
                const isRunning = state === 'running' || state === 'active' || state === 'started';
                const loading = actionLoading[id];
                const definition = p.definition || p.command || p.pipeline || '';

                return (
                  <TableRow
                    key={`${p._environmentId}-${id}-${idx}`}
                    className="border-b border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailPipeline(p)}
                  >
                    <TableCell className="py-3">
                      <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.875rem', fontWeight: 500 }}>
                        {getPipelineLabel(p)}
                      </Typography>
                      {p.start_time ? (
                        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', mt: 0.25 }}>
                          Started {formatTime(p.start_time)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          width: 6, height: 6, borderRadius: '50%',
                          backgroundColor: isSensorRunning(p._environmentId)
                            ? 'hsl(var(--success, 142 76% 36%))'
                            : 'hsl(var(--muted-foreground))',
                        }} />
                        <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.8rem' }}>
                          {p._environmentName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={state}
                        size="small"
                        color={getStateColor(state)}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          color: 'hsl(var(--muted-foreground))',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {definition}
                      </Typography>
                    </TableCell>
                    <TableCell className="text-right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {loading ? (
                          <CircularProgress size={18} sx={{ color: 'hsl(var(--muted-foreground))' }} />
                        ) : (
                          <>
                            {isRunning ? (
                              <Tooltip title="Stop">
                                <IconButton size="small" onClick={() => handleAction(p, 'stop')} sx={{ color: 'hsl(var(--destructive, 0 84% 60%))' }}>
                                  <StopIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Start">
                                <IconButton size="small" onClick={() => handleAction(p, 'start')} sx={{ color: 'hsl(142 76% 36%)' }}>
                                  <PlayArrowIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Copy command">
                              <IconButton size="small" onClick={() => copyToClipboard(definition)} sx={{ color: 'hsl(var(--muted-foreground))' }}>
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => handleAction(p, 'delete')} sx={{ color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive, 0 84% 60%))' } }}>
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Create Pipeline Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: '1.1rem' }}>
          Create Pipeline
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Environment</InputLabel>
            <MuiSelect
              value={newEnvId}
              onChange={(e) => setNewEnvId(e.target.value)}
              label="Environment"
              sx={{
                color: 'hsl(var(--foreground))',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--border))' },
              }}
            >
              {environments.filter(e => e.Type !== 'cloud').map(e => (
                <MenuItem key={e.id} value={e.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: isSensorRunning(e.id)
                        ? 'hsl(142 76% 36%)'
                        : 'hsl(var(--muted-foreground))',
                    }} />
                    {e.Name}
                  </Box>
                </MenuItem>
              ))}
            </MuiSelect>
          </FormControl>

          {/* AI Generation Toggle */}
          {!showAiSection ? (
            <Button
              size="small"
              startIcon={<AutoFixHighIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => setShowAiSection(true)}
              sx={{
                mb: 2,
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#FF6600',
                borderColor: 'rgba(255, 102, 0, 0.3)',
                '&:hover': { borderColor: '#FF6600', backgroundColor: 'rgba(255, 102, 0, 0.06)' },
              }}
              variant="outlined"
            >
              Generate with AI
            </Button>
          ) : (
            <Box sx={{
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              p: 2,
              mb: 2,
              backgroundColor: 'rgba(255, 102, 0, 0.03)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoFixHighIcon sx={{ fontSize: 16, color: '#FF6600' }} />
                <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.8rem', fontWeight: 600, flexGrow: 1 }}>
                  Generate with AI
                </Typography>
                <IconButton size="small" onClick={() => setShowAiSection(false)} sx={{ color: 'hsl(var(--muted-foreground))', p: 0.25 }}>
                  <Typography sx={{ fontSize: '0.7rem' }}>✕</Typography>
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  placeholder="e.g. Ingest Windows event logs over TCP and forward matches to OpenSearch"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  fullWidth
                  size="small"
                  autoFocus
                  disabled={isGenerating}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateFromAI(); } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 36,
                      backgroundColor: 'hsl(var(--muted))',
                      fontSize: '0.8rem',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'hsl(var(--foreground))',
                      '&::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 1 },
                    },
                  }}
                />
                <Button
                  onClick={handleGenerateFromAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  variant="outlined"
                  size="small"
                  sx={{
                    minWidth: 90,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    borderColor: 'rgba(255, 102, 0, 0.3)',
                    color: '#FF6600',
                    '&:hover': { borderColor: '#FF6600', backgroundColor: 'rgba(255, 102, 0, 0.06)' },
                  }}
                >
                  {isGenerating ? <CircularProgress size={16} sx={{ color: '#FF6600' }} /> : 'Generate'}
                </Button>
              </Box>
            </Box>
          )}

          <TextField
            label="Pipeline Command"
            placeholder='e.g. load_tcp "0.0.0.0:1514" { read_syslog } | import'
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            fullWidth
            multiline
            rows={4}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'hsl(var(--muted))',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                '& fieldset': { borderColor: justGenerated ? 'rgba(255, 102, 0, 0.6)' : 'hsl(var(--border))' },
                transition: 'border-color 0.3s',
              },
              '& .MuiOutlinedInput-input': { color: 'hsl(var(--foreground))' },
              '& .MuiInputLabel-root': { color: 'hsl(var(--muted-foreground))' },
            }}
          />

          {justGenerated && (
            <Chip
              label="✓ AI Generated"
              size="small"
              sx={{
                mt: 1,
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 102, 0, 0.12)',
                color: '#FF6600',
                border: '1px solid rgba(255, 102, 0, 0.3)',
              }}
            />
          )}

          {newEnvId && !isSensorRunning(newEnvId) && (
            <Alert severity="warning" sx={{ mt: 2, bgcolor: 'transparent', border: '1px solid rgba(255,152,0,0.3)', color: 'hsl(var(--foreground))' }}>
              Selected sensor is not running. Pipeline may not start.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'hsl(var(--muted-foreground))', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !newCommand.trim() || !newEnvId}
            variant="contained"
            sx={{ bgcolor: '#FF6600', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#e55b00' } }}
          >
            {isCreating ? <CircularProgress size={18} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailPipeline}
        onClose={() => setDetailPipeline(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        {detailPipeline && (() => {
          const state = getStateLabel(detailPipeline);
          const definition = detailPipeline.definition || detailPipeline.command || detailPipeline.pipeline || '';
          return (
            <>
              <DialogTitle sx={{ color: 'hsl(var(--foreground))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <StorageIcon sx={{ color: '#FF6600' }} />
                Pipeline Details
                <Chip
                  label={state}
                  size="small"
                  color={getStateColor(state)}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize', ml: 'auto' }}
                />
              </DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                  <Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Name
                    </Typography>
                    <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.875rem' }}>
                      {detailPipeline.name || getPipelineLabel(detailPipeline)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Environment
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%',
                        backgroundColor: isSensorRunning(detailPipeline._environmentId)
                          ? 'hsl(142 76% 36%)'
                          : 'hsl(var(--muted-foreground))',
                      }} />
                      <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.875rem' }}>
                        {detailPipeline._environmentName}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pipeline ID
                    </Typography>
                    <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {detailPipeline.pipeline || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Started
                    </Typography>
                    <Typography sx={{ color: 'hsl(var(--foreground))', fontSize: '0.875rem' }}>
                      {formatTime(detailPipeline.start_time)}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Command / Definition
                    </Typography>
                    <Tooltip title="Copy">
                      <IconButton size="small" onClick={() => copyToClipboard(definition)} sx={{ color: 'hsl(var(--muted-foreground))' }}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{
                    backgroundColor: 'hsl(var(--muted))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 1,
                    p: 2,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: 'hsl(var(--foreground))',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}>
                    {definition}
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
                <Button
                  onClick={() => { handleAction(detailPipeline, 'delete'); setDetailPipeline(null); }}
                  startIcon={<DeleteIcon />}
                  sx={{ color: 'hsl(var(--destructive, 0 84% 60%))', textTransform: 'none' }}
                >
                  Delete
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button onClick={() => setDetailPipeline(null)} sx={{ color: 'hsl(var(--muted-foreground))', textTransform: 'none' }}>
                    Close
                  </Button>
                  {state === 'running' || state === 'active' || state === 'started' ? (
                    <Button
                      onClick={() => { handleAction(detailPipeline, 'stop'); setDetailPipeline(null); }}
                      variant="contained"
                      startIcon={<StopIcon />}
                      sx={{ bgcolor: 'hsl(var(--destructive, 0 84% 60%))', textTransform: 'none', fontWeight: 600 }}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      onClick={() => { handleAction(detailPipeline, 'start'); setDetailPipeline(null); }}
                      variant="contained"
                      startIcon={<PlayArrowIcon />}
                      sx={{ bgcolor: '#FF6600', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#e55b00' } }}
                    >
                      Start
                    </Button>
                  )}
                </Box>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
};

export default PipelinesPage;
