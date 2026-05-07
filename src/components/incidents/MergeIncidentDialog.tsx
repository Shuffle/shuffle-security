import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Avatar,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SearchIcon from '@mui/icons-material/Search';
import MergeIcon from '@mui/icons-material/CallMerge';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { getDatastoreByCategory, setDatastoreItem, DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { mapOCSFSeverity, mapOCSFStatus, Observable } from '@/config/ocsfIncidentSchema';
import { severityColors, statusConfig } from '@/config/incidentConfig';
import { toast } from '@/lib/toast';
import { useEntityText } from '@/hooks/useEntityLabel';

interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  assignee: string;
  created: number;
  source: string;
  observableCount: number;
  taskCount: number;
  commentCount: number;
  rawValue: string;
}

interface MergeIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  currentIncidentId: string;
  currentIncidentTitle: string;
  onMergeComplete: () => void;
  /** When set, the candidate with this id is preselected and the dialog opens
   * directly on the confirmation step. Used by the merge-candidates banner so
   * the user can review and confirm in one click. */
  preselectedTargetId?: string;
}

const parseIncidentSummary = (item: { key: string; value: string; created?: number }): IncidentSummary | null => {
  try {
    const data = JSON.parse(item.value);
    const isNewFormat = 'finding_uid' in data && 'title' in data;
    const customAttrs = data.metadata?.extensions?.custom_attributes;

    let title = '';
    let severity = 'medium';
    let status = 'new';
    let assignee = '';
    let source = '';
    let observableCount = 0;
    let taskCount = 0;
    let commentCount = 0;

    if (isNewFormat) {
      title = data.title || '';
      severity = mapOCSFSeverity(data.severity_id || 3);
      status = mapOCSFStatus(data.status_id || 1);
      assignee = customAttrs?.assignee || data.assignee || '';
      source = data.product?.name || data.types?.[0] || '';
      observableCount = (customAttrs?.observables || data.observables || []).length;
      taskCount = (data.tasks || customAttrs?.tasks || []).length;
      commentCount = (data.activity || customAttrs?.activity || customAttrs?.comments || []).length;
    } else {
      const findingInfo = data.finding_info_list?.[0] || data.finding_info;
      title = findingInfo?.title || data.title || data.message || '';
      severity = mapOCSFSeverity(data.severity_id);
      status = mapOCSFStatus(data.status_id);
      assignee = data.assignee || '';
      source = data.metadata?.product?.name || '';
      observableCount = (data.observables || []).length;
      taskCount = (data.tasks || []).length;
      commentCount = (data.activity || []).length;
    }

    return {
      id: item.key,
      title: title || item.key,
      severity,
      status,
      assignee,
      created: item.created || 0,
      source,
      observableCount,
      taskCount,
      commentCount,
      rawValue: item.value,
    };
  } catch {
    return null;
  }
};

/**
 * Smart merge: merge source incident data INTO target incident.
 * Strategy inspired by ServiceNow/Jira:
 * - Observables: deduplicate and append
 * - Tasks: append all source tasks
 * - Activity/Comments: append with merge note
 * - References: deduplicate and append
 * - Labels/types: deduplicate and append
 * - Description: append source description below target
 * - Metadata (severity, assignee, status): keep target's values
 */
const smartMerge = (targetRaw: any, sourceRaw: any, sourceId: string, sourceTitle: string): any => {
  const merged = { ...targetRaw };

  // 1. Observables — deduplicate by type+value
  const targetObs: Observable[] = targetRaw.observables || targetRaw.metadata?.extensions?.custom_attributes?.observables || [];
  const sourceObs: Observable[] = sourceRaw.observables || sourceRaw.metadata?.extensions?.custom_attributes?.observables || [];
  const obsSet = new Set(targetObs.map(o => `${o.type}::${o.value}`));
  const mergedObs = [...targetObs, ...sourceObs.filter(o => !obsSet.has(`${o.type}::${o.value}`))];
  merged.observables = mergedObs;

  // 2. Tasks — append all with source prefix
  const targetTasks = targetRaw.tasks || targetRaw.metadata?.extensions?.custom_attributes?.tasks || [];
  const sourceTasks = (sourceRaw.tasks || sourceRaw.metadata?.extensions?.custom_attributes?.tasks || []).map((t: any) => ({
    ...t,
    id: `merged-${sourceId}-${t.id || Date.now()}`,
    title: t.title,
    group: t.group || `Merged from ${sourceTitle || sourceId}`,
  }));
  merged.tasks = [...targetTasks, ...sourceTasks];

  // 3. Activity — append with merge marker
  const targetActivity = targetRaw.activity || [];
  const sourceActivity = (sourceRaw.activity || []).map((a: any) => ({
    ...a,
    id: `merged-${sourceId}-${a.id || Date.now()}`,
  }));
  const mergeNote = {
    id: `merge-${Date.now()}`,
    type: 'system',
    user: 'System',
    timestamp: Date.now(),
    content: `Merged incident "${sourceTitle || sourceId}" (${sourceId}) into this incident`,
  };
  merged.activity = [...targetActivity, mergeNote, ...sourceActivity];

  // 4. References — deduplicate
  const existingFinding = merged.finding_info_list?.[0] || {};
  const targetRefs: string[] = existingFinding.references || merged.references || [];
  const sourceRefs: string[] = sourceRaw.finding_info_list?.[0]?.references || sourceRaw.references || [];
  const allRefs = [...new Set([...targetRefs, ...sourceRefs])];
  if (merged.finding_info_list?.[0]) {
    merged.finding_info_list[0].references = allRefs;
  }

  // 5. Labels/types — deduplicate
  const targetTypes: string[] = merged.types || [];
  const sourceTypes: string[] = sourceRaw.types || [];
  merged.types = [...new Set([...targetTypes, ...sourceTypes])];

  // 6. Description — append source if different
  const targetDesc = merged.desc || '';
  const sourceDesc = sourceRaw.desc || sourceRaw.message || '';
  if (sourceDesc && sourceDesc !== targetDesc) {
    merged.desc = targetDesc
      ? `${targetDesc}\n\n--- Merged from ${sourceTitle || sourceId} ---\n${sourceDesc}`
      : sourceDesc;
  }

  // 7. Related events — track merged incident
  const relatedEvents = merged.related_events || [];
  if (!relatedEvents.includes(sourceId)) {
    merged.related_events = [...relatedEvents, sourceId];
  }

  return merged;
};

export const MergeIncidentDialog = ({
  open,
  onClose,
  currentIncidentId,
  currentIncidentTitle,
  onMergeComplete,
  preselectedTargetId,
}: MergeIncidentDialogProps) => {
  const t = useEntityText();
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<IncidentSummary | null>(null);
  const [merging, setMerging] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Load all incidents for selection
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch('');
    setSelectedTarget(null);
    setStep('select');

    getDatastoreByCategory(DATASTORE_CATEGORIES.INCIDENTS).then(result => {
      if (result.success && result.data) {
        const parsed = result.data
          .filter(item => item.key !== currentIncidentId) // exclude current
          .map(item => parseIncidentSummary(item))
          .filter(Boolean) as IncidentSummary[];
        // Sort by created desc
        parsed.sort((a, b) => b.created - a.created);
        setIncidents(parsed);

        // If the caller pre-selected a target (e.g. from the banner),
        // jump straight to the confirm step with it selected.
        if (preselectedTargetId) {
          const pre = parsed.find(i => i.id === preselectedTargetId);
          if (pre) {
            setSelectedTarget(pre);
            setStep('confirm');
          }
        }
      }
      setLoading(false);
    });
  }, [open, currentIncidentId, preselectedTargetId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q) ||
      i.source.toLowerCase().includes(q)
    );
  }, [incidents, search]);

  const handleMerge = useCallback(async () => {
    if (!selectedTarget) return;
    setMerging(true);

    try {
      // The current incident is the SOURCE (being merged into the target)
      const sourceRaw = incidents.length > 0
        ? JSON.parse(incidents.find(i => i.id === currentIncidentId)?.rawValue || '{}')
        : {};
      
      // Fetch current incident's raw data fresh
      const { getDatastoreItem } = await import('@/Shuffle-MCPs/datastore');
      const currentResult = await getDatastoreItem(currentIncidentId, DATASTORE_CATEGORIES.INCIDENTS);
      const currentRaw = currentResult.item ? JSON.parse(currentResult.item.value) : {};

      // Parse target's raw data
      const targetRaw = JSON.parse(selectedTarget.rawValue);

      // Perform smart merge: current incident merges INTO target
      const mergedData = smartMerge(targetRaw, currentRaw, currentIncidentId, currentIncidentTitle);

      // Save the merged target
      const saveResult = await setDatastoreItem(
        selectedTarget.id,
        JSON.stringify(mergedData),
        DATASTORE_CATEGORIES.INCIDENTS
      );

      if (!saveResult.success) {
        toast.error(t('Failed to save merged incident'));
        setMerging(false);
        return;
      }

      // Mark the source (current) incident as merged
      const sourceUpdate = {
        ...currentRaw,
        status_id: 99, // Custom "merged" status
        status: 'Merged',
        merged_into: selectedTarget.id,
        merged_at: Date.now(),
      };

      // Add merge activity to the source incident
      const sourceActivity = sourceUpdate.activity || [];
      sourceUpdate.activity = [
        ...sourceActivity,
        {
          id: `merge-${Date.now()}`,
          type: 'system',
          user: 'System',
          timestamp: Date.now(),
          content: `This incident was merged into "${selectedTarget.title}" (${selectedTarget.id})`,
        },
      ];

      await setDatastoreItem(
        currentIncidentId,
        JSON.stringify(sourceUpdate),
        DATASTORE_CATEGORIES.INCIDENTS
      );

      toast.success(`Merged into "${selectedTarget.title}"`);
      onMergeComplete();
      onClose();
    } catch (err) {
      console.error('Merge failed:', err);
      toast.error('Merge failed — see console for details');
    } finally {
      setMerging(false);
    }
  }, [selectedTarget, currentIncidentId, currentIncidentTitle, onMergeComplete, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <MergeIcon sx={{ fontSize: 20, color: 'hsl(var(--primary))' }} />
            {step === 'select' ? t('Merge Incident') : 'Confirm Merge'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? t('Select the target incident to merge this one into. All tasks, observables, and comments will be combined.')
              : 'Review the merge details below. This action cannot be undone.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <>
            {/* Search */}
            <Box sx={{ px: 3, pb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={t('Search incidents by title, ID, or source...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: 'hsl(var(--muted))',
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    '& fieldset': { borderColor: 'hsl(var(--border))' },
                  },
                }}
              />
            </Box>

            {/* Incident list */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 2, minHeight: 200, maxHeight: 400 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} sx={{ color: 'hsl(var(--primary))' }} />
                </Box>
              ) : filtered.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
                  {search ? 'No matching incidents found' : 'No other incidents available'}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {filtered.map((inc) => {
                    const isSelected = selectedTarget?.id === inc.id;
                    const sevColor = severityColors[inc.severity] || severityColors.medium;
                    const statConfig = statusConfig[inc.status];
                    const isMerged = inc.status === 'Merged';

                    return (
                      <Box
                        key={inc.id}
                        onClick={() => !isMerged && setSelectedTarget(isSelected ? null : inc)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 2,
                          py: 1.5,
                          borderRadius: 2,
                          cursor: isMerged ? 'not-allowed' : 'pointer',
                          opacity: isMerged ? 0.5 : 1,
                          border: isSelected ? '1px solid hsl(var(--primary))' : '1px solid transparent',
                          bgcolor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                          '&:hover': isMerged ? {} : {
                            bgcolor: isSelected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted) / 0.4)',
                          },
                          transition: 'all 0.15s',
                        }}
                      >
                        {/* Severity dot */}
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sevColor, flexShrink: 0 }} />

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {inc.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {inc.id.substring(0, 12)}…
                            </Typography>
                            {inc.source && (
                              <Chip label={inc.source} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted) / 0.5)' }} />
                            )}
                            {isMerged && (
                              <Chip label="Merged" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted) / 0.5)' }} />
                            )}
                          </Box>
                        </Box>

                        {/* Stats */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                          {inc.taskCount > 0 && (
                            <Chip label={`${inc.taskCount} tasks`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted) / 0.5)' }} />
                          )}
                          {inc.observableCount > 0 && (
                            <Chip label={`${inc.observableCount} IOCs`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted) / 0.5)' }} />
                          )}
                        </Box>

                        {/* Selected indicator */}
                        {isSelected && (
                          <CheckCircleIcon sx={{ fontSize: 20, color: 'hsl(var(--primary))', flexShrink: 0 }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            <DialogFooter className="px-6 pb-6 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!selectedTarget}
                onClick={() => setStep('confirm')}
                className="bg-[#ff6600] hover:bg-[#e55c00] text-white"
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && selectedTarget && (
          <>
            <Box sx={{ px: 3, pb: 2 }}>
              {/* Visual merge direction */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 2,
                bgcolor: 'hsl(var(--muted) / 0.35)',
                border: '1px solid hsl(var(--border))',
              }}>
                {/* Source (current) */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Source (this incident)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentIncidentTitle || currentIncidentId}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Will be marked as "Merged"
                  </Typography>
                </Box>

                {/* Arrow */}
                <ArrowForwardIcon sx={{ color: 'hsl(var(--primary))', fontSize: 28, flexShrink: 0 }} />

                {/* Target */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Target (merge into)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedTarget.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--severity-low))' }}>
                    Will receive merged data
                  </Typography>
                </Box>
              </Box>

              {/* What will be merged */}
              <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'hsl(var(--muted) / 0.35)', border: '1px solid hsl(var(--border))' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  What will be merged:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {[
                    'Observables (IOCs) — deduplicated',
                    'Tasks — appended with source grouping',
                    'Comments & activity — appended with merge note',
                    'References — deduplicated',
                    'Labels — deduplicated',
                    'Description — appended below target description',
                  ].map((item, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: 'hsl(var(--severity-low))' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Warning */}
              <Box sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'hsl(var(--severity-medium) / 0.08)',
                border: '1px solid hsl(var(--severity-medium) / 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}>
                <WarningAmberIcon sx={{ fontSize: 18, color: 'hsl(var(--severity-medium))', mt: 0.25 }} />
                <Typography variant="caption" sx={{ color: 'hsl(var(--severity-medium))' }}>
                  The current incident will be marked as "Merged" and will reference the target. The target's severity, assignee, and status will be kept as-is.
                </Typography>
              </Box>
            </Box>

            <DialogFooter className="px-6 pb-6 pt-2">
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button
                disabled={merging}
                onClick={handleMerge}
                className="bg-[#ff6600] hover:bg-[#e55c00] text-white"
              >
                {merging ? (
                  <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                ) : (
                  <MergeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                )}
                Merge Incident
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
