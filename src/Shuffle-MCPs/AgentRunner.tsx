/**
 * AgentRunner — Standalone hero-style agent prompt UI.
 *
 * Modernized "What do you want to do?" surface inspired by Shuffle's
 * agent launcher. Big centered icon + heading, large rounded prompt
 * field with send button, and a row of app/MCP chips below.
 *
 * - Uses {@link AppSearchDrawer} from this library to pick MCP targets.
 * - Calls `/api/v1/agent` via {@link runAgent} from the host services.
 *
 * Pair with {@link AgentDebugger} for run inspection.
 */

import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  InputBase,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CloseIcon from '@mui/icons-material/Close';
import { Paperclip, X } from 'lucide-react';

import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import AppSearchDrawer from '@/Shuffle-MCPs/AppSearchDrawer';
import AgentRunResultViewer from '@/components/agent/AgentRunResultViewer';
import { runAgent } from '@/services/agentRun';
import type { AgentRun } from '@/services/agentActivity';

export interface AgentRunnerSelectedApp {
  name: string;
  icon?: string;
  categories?: string[];
}

export interface AgentRunnerProps {
  /** Headline shown above the prompt. */
  title?: string;
  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Pre-selected MCP target chips. */
  initialApps?: AgentRunnerSelectedApp[];
  /** Hide the centered hero icon (compact mode). */
  hideIcon?: boolean;
  /** Called after each successful or failed run. */
  onRun?: (result: { input: string; success: boolean; run?: AgentRun; error?: string }) => void;
  /** Maximum width of the centered card. */
  maxWidth?: number;
}

const AgentRunner = ({
  title = 'What do you want to do?',
  placeholder = 'Describe a task, e.g. "Get my emails for today and summarise them"',
  initialApps = [],
  hideIcon = false,
  onRun,
  maxWidth = 760,
}: AgentRunnerProps) => {
  const [input, setInput] = useState('');
  const [selectedApps, setSelectedApps] = useState<AgentRunnerSelectedApp[]>(initialApps);
  const [appSearchOpen, setAppSearchOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readImageAsDataUrl = (file: File): Promise<{ dataUrl: string; name: string } | null> =>
    new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        resolve(typeof r === 'string' ? { dataUrl: r, name: file.name || 'Pasted image' } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const handleImagesSelected = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const results = await Promise.all(arr.map(readImageAsDataUrl));
    const valid = results.filter((r): r is { dataUrl: string; name: string } => r !== null);
    if (valid.length > 0) {
      setAttachedImages((prev) => [...prev, ...valid]);
      setError(null);
    }
  };

  const handleRun = async () => {
    const text = input.trim();
    if (!text || isRunning) return;
    setIsRunning(true);
    setRun(null);
    setError(null);

    const result = await runAgent({
      input: text,
      ...(selectedApps.length === 1 ? { toolName: selectedApps[0].name } : {}),
      ...(selectedApps.length > 1 ? { toolNames: selectedApps.map((a) => a.name) } : {}),
      ...(attachedImages.length > 0 ? {
        images: attachedImages.map((img) => {
          const m = /^data:([^;]+);base64,(.*)$/.exec(img.dataUrl);
          return m
            ? { mimeType: m[1], data: m[2], name: img.name }
            : { mimeType: 'image/png', data: img.dataUrl, name: img.name };
        }),
      } : {}),
    });

    if (result.success) {
      const rawData = result.rawData as Record<string, any> | undefined;
      const newRun: AgentRun = {
        execution_id: rawData?.execution_id || crypto.randomUUID(),
        workflow_id: rawData?.workflow_id || '',
        status: rawData?.status || 'FINISHED',
        started_at: new Date().toISOString(),
        results: [{
          result: typeof result.rawData === 'object' ? JSON.stringify(result.rawData) : result.content,
          action: {},
        }],
      };
      setRun(newRun);
      onRun?.({ input: text, success: true, run: newRun });
    } else {
      setError(result.error || 'Agent run failed.');
      onRun?.({ input: text, success: false, error: result.error });
    }
    setIsRunning(false);
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
        {!hideIcon && (
          <Box sx={{
            width: 84,
            height: 84,
            borderRadius: 3,
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <AgentIcon size={56} />
          </Box>
        )}

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.75rem', md: '2.25rem' },
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </Typography>

        {/* Prompt field */}
        <Box sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderRadius: 999,
          border: '1.5px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          px: 3,
          py: 1.75,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          '&:focus-within': {
            borderColor: 'hsl(var(--primary))',
            boxShadow: '0 0 0 3px hsla(var(--primary) / 0.12)',
          },
        }}>
          {attachedImages.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.5 }}>
              {attachedImages.map((img, idx) => (
                <Box key={`${img.name}-${idx}`} sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 0.5,
                  pr: 1,
                  borderRadius: 1.5,
                  border: '1px solid hsl(var(--border))',
                  bgcolor: 'hsl(var(--background))',
                }}>
                  <Box component="img" src={img.dataUrl} alt={img.name}
                    sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'cover' }} />
                  <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--foreground))', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.name}
                  </Typography>
                  <IconButton size="small" onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                    sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }}>
                    <X size={12} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}>
            <InputBase
              inputRef={inputRef}
              autoFocus
              multiline
              minRows={1}
              maxRows={6}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              fullWidth
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleRun();
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                const files: File[] = [];
                for (const item of Array.from(items)) {
                  if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const f = item.getAsFile();
                    if (f) files.push(f);
                  }
                }
                if (files.length > 0) {
                  e.preventDefault();
                  handleImagesSelected(files);
                }
              }}
              sx={{
                fontSize: '1rem',
                color: 'hsl(var(--foreground))',
                '& textarea::placeholder': {
                  color: 'hsl(var(--muted-foreground))',
                  opacity: 0.7,
                },
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                handleImagesSelected(e.target.files);
                if (e.target) e.target.value = '';
              }}
            />
            <Tooltip title="Attach image">
              <IconButton
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                sx={{
                  width: 36,
                  height: 36,
                  color: attachedImages.length > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  bgcolor: attachedImages.length > 0 ? 'hsla(var(--primary) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' },
                }}
              >
                <Paperclip size={16} />
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={handleRun}
              disabled={!input.trim() || isRunning}
              sx={{
                width: 36,
                height: 36,
                bgcolor: input.trim() && !isRunning ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: input.trim() && !isRunning ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                '&:hover': input.trim() && !isRunning ? { filter: 'brightness(1.1)', bgcolor: 'hsl(var(--primary))' } : {},
                '&.Mui-disabled': {
                  bgcolor: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                },
              }}
            >
              {isRunning ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 22 }} />}
            </IconButton>
          </Box>
        </Box>

        {/* App / MCP chips row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
          <Box
            component="button"
            type="button"
            onClick={() => setAppSearchOpen(true)}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.75,
              py: 0.75,
              borderRadius: 999,
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary))',
                bgcolor: 'hsla(var(--primary) / 0.08)',
              },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
            Select Apps / MCPs
          </Box>

          {selectedApps.map((app) => (
            <Box
              key={app.name}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                pl: 0.5,
                pr: 0.75,
                py: 0.5,
                borderRadius: 999,
                border: '1px solid hsl(var(--border))',
                bgcolor: 'hsl(var(--card))',
                fontSize: '0.85rem',
                color: 'hsl(var(--foreground))',
              }}
            >
              <Avatar
                src={app.icon || `https://shuffler.io/images/apps/${app.name}.png`}
                alt={app.name}
                variant="rounded"
                sx={{ width: 22, height: 22, bgcolor: 'transparent' }}
              />
              <Typography sx={{ fontSize: '0.85rem', mx: 0.25 }}>
                {app.name.replace(/_/g, ' ')}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setSelectedApps(prev => prev.filter(a => a.name !== app.name))}
                sx={{ p: 0.25, color: 'hsl(var(--muted-foreground))', '&:hover': { color: 'hsl(var(--destructive))' } }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>

        {error && (
          <Alert severity="error" sx={{ width: '100%', borderRadius: 2, fontSize: '0.85rem' }}>
            {error}
          </Alert>
        )}

        {run && (
          <Box sx={{
            width: '100%',
            borderRadius: 2,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--background))',
            overflow: 'hidden',
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', px: 2.5, pt: 2, pb: 0.5 }}>
              Result
            </Typography>
            <AgentRunResultViewer run={run} />
          </Box>
        )}
      </Box>

      <AppSearchDrawer
        open={appSearchOpen}
        onClose={() => setAppSearchOpen(false)}
        title="Select Apps / MCPs"
        subtitle="Pick the tools the agent is allowed to use for this run"
        onQuickSelect={(app) => {
          setSelectedApps((prev) =>
            prev.some((a) => a.name === app.name) ? prev : [...prev, app]
          );
        }}
      />
    </Box>
  );
};

export default AgentRunner;
