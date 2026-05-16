/**
 * DemoFallbackAuditBanner — support-only banner that surfaces *why* the demo
 * had to fall back to a static IOC instead of using one from the live
 * `ioc_url` / `ioc_ip` datastore categories. Shown only when:
 *   1. The current user is a Shuffle support user (or `?support=1` is set).
 *   2. The incident carries `metadata.extensions.custom_attributes.demoFallback`.
 *   3. The latest audit (`shuffle_demo_ioc_audit` in localStorage) is present.
 *
 * The audit itself is written by `pickRandomIocs` in services/demoMode.ts —
 * see DEMO_IOC_AUDIT_KEY for the schema. This banner is read-only.
 */

import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, FlaskConical as ScienceIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Box, Typography, Collapse, IconButton, Chip } from '@mui/material';
import { DEMO_IOC_AUDIT_KEY, type DemoIocAudit } from '@/services/demoMode';

const REASON_LABELS: Record<string, string> = {
  'accepted-key': 'Accepted (URL/IP key)',
  'accepted-value': 'Accepted (extracted from STIX value)',
  'rejected-binary-key': 'Rejected — binary / non-printable key',
  'rejected-key-not-url': 'Rejected — key is not an http(s) URL and value had no usable URL',
  'rejected-value-no-url': 'Rejected — STIX pattern / value contained no recognisable URL or IP',
  'rejected-empty-value': 'Rejected — empty value, key alone was not a URL/IP',
};

const Bucket = ({
  title,
  bucket,
  category,
}: {
  title: string;
  bucket: DemoIocAudit['ip'] | DemoIocAudit['url'];
  category: string;
}) => (
  <Box sx={{ mb: 1.5 }}>
    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'block', mb: 0.5 }}>
      {title} <Box component="code" sx={{ fontSize: 11, color: 'text.secondary' }}>({category})</Box>
    </Typography>
    {!bucket.fetched ? (
      <Typography variant="caption" sx={{ color: 'hsl(var(--destructive))' }}>
        Datastore fetch failed: {bucket.httpError || 'unknown error'}
      </Typography>
    ) : (
      <>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
          Total fetched: <strong>{bucket.total}</strong>
          {bucket.truncated && ' (page cap of 100 hit — items beyond page 1 were not inspected)'}
          {' · '}Accepted: <strong>{bucket.accepted}</strong>
          {' · '}Rejected: <strong>{bucket.rejected}</strong>
          {' · '}Used fallback: <strong>{bucket.usedFallback ? 'yes' : 'no'}</strong>
        </Typography>
        {Object.keys(bucket.reasons).length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
            {Object.entries(bucket.reasons).map(([reason, count]) => (
              <Chip
                key={reason}
                size="small"
                label={`${REASON_LABELS[reason] || reason}: ${count}`}
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: reason.startsWith('accepted-') ? 'hsl(var(--muted) / 0.6)' : 'hsl(var(--destructive) / 0.12)',
                  color: reason.startsWith('accepted-') ? 'text.secondary' : 'hsl(var(--destructive))',
                  border: '1px solid',
                  borderColor: reason.startsWith('accepted-') ? 'hsl(var(--border))' : 'hsl(var(--destructive) / 0.4)',
                }}
              />
            ))}
          </Box>
        )}
        {bucket.samples.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.25 }}>
              Sample rejected keys:
            </Typography>
            <Box component="pre" sx={{
              m: 0, p: 1, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4,
              bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 1,
              overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {bucket.samples.map(s => `${s.reason.padEnd(24)}  ${s.key}`).join('\n')}
            </Box>
          </Box>
        )}
      </>
    )}
  </Box>
);

export const DemoFallbackAuditBanner = ({ visible }: { visible: boolean }) => {
  const [audit, setAudit] = useState<DemoIocAudit | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    try {
      const raw = localStorage.getItem(DEMO_IOC_AUDIT_KEY);
      if (raw) setAudit(JSON.parse(raw) as DemoIocAudit);
    } catch { /* ignore */ }
  }, [visible]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        mb: 2,
        border: '1px solid hsl(var(--destructive) / 0.5)',
        borderRadius: 1,
        bgcolor: 'hsl(var(--destructive) / 0.06)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <ScienceIcon sx={{ fontSize: 16, color: 'hsl(var(--destructive))' }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--destructive))', flex: 1 }}>
          Demo fallback IOC in use — support audit
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {audit ? `audit @ ${new Date(audit.timestamp).toLocaleTimeString()}` : 'no audit recorded'}
        </Typography>
        <IconButton size="small" sx={{ color: 'hsl(var(--destructive))' }}>
          {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
            This incident is using static fallback IOCs because the live IOC datastore did not yield a usable
            entry at seed time. The breakdown below shows what was fetched, what was accepted, and the reason
            each rejected entry was skipped. Same data is logged to the console as <code>[demo:ioc-audit]</code>.
          </Typography>
          {audit ? (
            <>
              <Bucket title="IP candidates" bucket={audit.ip} category="ioc_ipv4" />
              <Bucket title="URL candidates" bucket={audit.url} category="ioc_url" />
            </>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No audit record found in <code>localStorage[{DEMO_IOC_AUDIT_KEY}]</code>. The fallback was
              picked in a previous session — re-trigger demo seeding (or open the browser console for the
              <code> [demo:ioc-audit]</code> log) to capture a fresh audit.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default DemoFallbackAuditBanner;
