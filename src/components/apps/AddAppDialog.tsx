import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getApiUrl, getAuthHeader } from '@shuffleio/shuffle-mcps';
import { toast } from '@/lib/toast';

const DOC_TO_OPENAPI_URL = 'https://doc-to-openapi-stbuwivzoq-nw.a.run.app/api/v1/doc_to_openapi';

type Stage = 'idle' | 'checking' | 'existing' | 'generating' | 'preview' | 'verifying' | 'done' | 'error';

interface ExistingMatch {
  objectID: string;
  name: string;
  description?: string;
  image_url?: string;
  categories?: string[];
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s) || /\/|\.[a-z]{2,}(\/|$)/i.test(s);

/** Semi-exact match: normalized names equal, or one contains the other and is
 *  at least 4 chars, so "gmail" matches "Gmail" and "sentinelone" matches
 *  "SentinelOne" but a bare "api" does not match everything. */
const isSemiExactMatch = (query: string, hitName: string) => {
  const q = normalize(query);
  const n = normalize(hitName);
  if (!q || !n) return false;
  if (q === n) return true;
  if (q.length >= 4 && (n.includes(q) || q.includes(n))) return true;
  return false;
};


interface OpenApiSpec {
  info?: {
    title?: string;
    description?: string;
    'x-image'?: string;
    [k: string]: unknown;
  };
  paths?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

interface AddAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (appId: string) => void;
}

// ─── Minimal loader: centered spinner with a single status line ────────────
const DotsLoader = ({ message }: { message: string }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: 'hsl(var(--primary))',
              animation: 'addapp-bounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {message}
      </div>
      <style>{`
        @keyframes addapp-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export const AddAppDialog = ({ open, onOpenChange, onCreated }: AddAppDialogProps) => {
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [createdAppId, setCreatedAppId] = useState<string>('');
  const [existing, setExisting] = useState<ExistingMatch | null>(null);
  const [liveHits, setLiveHits] = useState<ExistingMatch[]>([]);
  const [liveSearching, setLiveSearching] = useState(false);

  const title = spec?.info?.title || '';

  // Live Algolia search as the user types (idle stage only).
  useEffect(() => {
    if (stage !== 'idle') return;
    const q = input.trim();
    if (!q || looksLikeUrl(q)) {
      setLiveHits([]);
      setLiveSearching(false);
      return;
    }
    setLiveSearching(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { algoliasearch } = await import('algoliasearch');
        const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
        const res = await client.searchSingleIndex({
          indexName: 'appsearch',
          searchParams: { query: q, hitsPerPage: 5 },
        });
        if (cancelled) return;
        setLiveHits(((res.hits as unknown[]) || []) as ExistingMatch[]);
      } catch {
        if (!cancelled) setLiveHits([]);
      } finally {
        if (!cancelled) setLiveSearching(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [input, stage]);

  const reset = useCallback(() => {
    setInput('');
    setStage('idle');
    setSpec(null);
    setErrorMsg('');
    setCreatedAppId('');
    setExisting(null);
  }, []);

  useEffect(() => {
    if (!open) {
      // Reset a moment after close animation
      const t = setTimeout(reset, 250);
      return () => clearTimeout(t);
    }
  }, [open, reset]);

  /** Actual OpenAPI generation. Split out so we can call it either directly
   *  (URL input) or after the user rejects an existing Algolia match. */
  const runGeneration = useCallback(async (value: string) => {
    setStage('generating');
    setErrorMsg('');
    try {
      const res = await fetch(DOC_TO_OPENAPI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      if (!res.ok) throw new Error(`Failed to generate spec (${res.status})`);
      const data = await res.json();
      const openapiSpec: OpenApiSpec =
        (data && typeof data === 'object' && 'info' in data)
          ? data
          : (data?.openapi ?? data?.spec ?? data);
      if (!openapiSpec || typeof openapiSpec !== 'object') {
        throw new Error('No OpenAPI spec returned');
      }
      setSpec(openapiSpec);
      setStage('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(msg);
      setStage('error');
    }
  }, []);

  const handleGenerate = async () => {
    const value = input.trim();
    if (!value) {
      toast.error('Enter a name or documentation URL');
      return;
    }

    // URL inputs skip the Algolia check — the user has clearly picked a
    // documentation source rather than trying to reuse an existing app.
    if (looksLikeUrl(value)) {
      await runGeneration(value);
      return;
    }

    // Name input: check Algolia for a semi-exact match to avoid re-creating
    // an app that already exists in the catalog.
    setStage('checking');
    setErrorMsg('');
    try {
      const { algoliasearch } = await import('algoliasearch');
      const client = algoliasearch('JNSS5CFDZZ', '33e4e3564f4f060e96e0531957bed552');
      const res = await client.searchSingleIndex({
        indexName: 'appsearch',
        searchParams: { query: value, hitsPerPage: 5 },
      });
      const hits = ((res.hits as unknown[]) || []) as ExistingMatch[];
      const match = hits.find((h) => isSemiExactMatch(value, h?.name || ''));
      if (match) {
        setExisting(match);
        setStage('existing');
        return;
      }
    } catch {
      // Algolia unavailable — fall through and generate anyway.
    }
    await runGeneration(value);
  };



  const handleCreate = async () => {
    if (!spec) return;
    setStage('verifying');
    setErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/v1/verify_openapi'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(spec),
      });
      if (!res.ok) throw new Error(`Verification failed (${res.status})`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.reason || 'Verification failed');
      setCreatedAppId(data.id || '');
      setStage('done');
      toast.success('App created');
      if (data.id) onCreated?.(data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(msg);
      setStage('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="flex items-center gap-2">
            <Plus size={18} style={{ color: 'hsl(var(--primary))' }} />
            Add app
          </DialogTitle>
        </DialogHeader>

        {stage === 'idle' && (
          <div className="py-4">
            <Input
              autoFocus
              placeholder="App name or docs URL"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
              className="h-11 text-center"
            />
          </div>
        )}

        {stage === 'checking' && <DotsLoader message="Checking existing apps…" />}
        {stage === 'generating' && <DotsLoader message="Generating app…" />}
        {stage === 'verifying' && <DotsLoader message="Finishing up…" />}

        {stage === 'existing' && existing && (
          <div className="py-4 text-center space-y-2">
            <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              <span style={{ color: 'hsl(var(--foreground))' }}>{existing.name}</span> already exists.
            </div>
            <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Use it or generate a new version.
            </div>
          </div>
        )}

        {stage === 'preview' && spec && (
          <div className="py-4 text-center">
            <div className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
              {title || 'Untitled app'}
            </div>
            <div className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Ready to create.
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={44} style={{ color: 'hsl(var(--primary))' }} />
            <div className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
              {title || 'App'} created
            </div>
            {createdAppId && (
              <div className="text-xs font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
                ID: {createdAppId}
              </div>
            )}
          </div>
        )}

        {stage === 'error' && (
          <div className="py-4 flex items-start gap-3 p-3 rounded-md"
            style={{
              border: '1px solid hsl(var(--destructive) / 0.4)',
              background: 'hsl(var(--destructive) / 0.08)',
            }}
          >
            <AlertTriangle size={18} style={{ color: 'hsl(var(--destructive))' }} />
            <div className="text-sm" style={{ color: 'hsl(var(--foreground))' }}>
              {errorMsg || 'Something went wrong.'}
            </div>
          </div>
        )}

        <DialogFooter className="justify-center sm:justify-center">
          {stage === 'idle' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={!input.trim()}>Add</Button>
            </>
          )}
          {(stage === 'checking' || stage === 'generating' || stage === 'verifying') && (
            <Button variant="ghost" disabled>Working…</Button>
          )}
          {stage === 'existing' && existing && (
            <>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
              <Button
                variant="outline"
                onClick={() => { setExisting(null); runGeneration(input.trim()); }}
              >
                Generate anyway
              </Button>
              <Button
                onClick={() => {
                  if (existing.objectID) onCreated?.(existing.objectID);
                  onOpenChange(false);
                }}
              >
                Use existing
              </Button>
            </>
          )}
          {stage === 'preview' && (
            <>
              <Button variant="ghost" onClick={reset}>Try another</Button>
              <Button onClick={handleCreate}>Create app</Button>
            </>
          )}
          {stage === 'error' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={spec ? handleCreate : handleGenerate}>Retry</Button>
            </>
          )}
          {stage === 'done' && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AddAppButtonProps {
  onCreated?: (appId: string) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  label?: string;
}

export const AddAppButton = ({ onCreated, variant = 'outline', size = 'sm', label = 'Add app' }: AddAppButtonProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1.5" />
        {label}
      </Button>
      <AddAppDialog open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  );
};

export default AddAppDialog;
