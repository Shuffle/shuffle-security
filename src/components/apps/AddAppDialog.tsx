import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Link2, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
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

// ─── Fun loader: scanning radar with rotating status text ────────────────────
const GENERATION_MESSAGES = [
  'Fetching documentation…',
  'Parsing endpoints…',
  'Extracting schemas…',
  'Inferring authentication…',
  'Assembling OpenAPI spec…',
];

const VERIFICATION_MESSAGES = [
  'Validating spec…',
  'Compiling app…',
  'Registering integration…',
];

const RadarLoader = ({ messages }: { messages: string[] }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1600);
    return () => clearInterval(t);
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-6">
      <div className="relative w-32 h-32">
        {/* Rings */}
        {[0, 1, 2].map((r) => (
          <div
            key={r}
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor: 'hsl(var(--border))',
              transform: `scale(${1 - r * 0.22})`,
            }}
          />
        ))}
        {/* Sweep */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{ animation: 'addapp-spin 2.4s linear infinite' }}
        >
          <div
            className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
            style={{
              background:
                'conic-gradient(from 0deg, hsl(var(--primary) / 0.55), transparent 55%)',
            }}
          />
        </div>
        {/* Center dot */}
        <div
          className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full"
          style={{
            transform: 'translate(-50%, -50%)',
            background: 'hsl(var(--primary))',
            boxShadow: '0 0 12px hsl(var(--primary) / 0.7)',
          }}
        />
        {/* Blips */}
        {[
          { top: '18%', left: '30%', delay: '0s' },
          { top: '62%', left: '72%', delay: '0.6s' },
          { top: '40%', left: '80%', delay: '1.1s' },
          { top: '75%', left: '25%', delay: '1.7s' },
        ].map((b, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: b.top,
              left: b.left,
              background: 'hsl(var(--primary))',
              animation: `addapp-blip 2.4s ${b.delay} ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="text-center min-h-[40px]">
        <div
          key={idx}
          className="text-sm font-medium"
          style={{
            color: 'hsl(var(--foreground))',
            animation: 'addapp-fade 0.4s ease',
          }}
        >
          {messages[idx]}
        </div>
        <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          This can take up to a minute.
        </div>
      </div>

      <style>{`
        @keyframes addapp-spin { to { transform: rotate(360deg); } }
        @keyframes addapp-blip {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes addapp-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
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

  const endpointCount = (() => {
    if (!spec?.paths) return 0;
    let count = 0;
    for (const p of Object.values(spec.paths)) {
      if (p && typeof p === 'object') count += Object.keys(p).length;
    }
    return count;
  })();

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

  const title = spec?.info?.title || '';
  const description = spec?.info?.description || '';
  const image = (spec?.info as { 'x-image'?: string } | undefined)?.['x-image'] || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'hsl(var(--primary))' }} />
            Generate a new app
          </DialogTitle>
          <DialogDescription>
            Paste an API documentation URL or a product name. We will generate an OpenAPI spec
            and turn it into a Shuffle app.
          </DialogDescription>
        </DialogHeader>

        {stage === 'idle' && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Link2
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Input
                autoFocus
                placeholder="https://docs.example.com/api  or  Example API"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                className="pl-9 h-11"
              />
            </div>
            <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Tip: A link to the vendor's REST API reference gives the best results.
            </div>
          </div>
        )}

        {stage === 'generating' && <RadarLoader messages={GENERATION_MESSAGES} />}
        {stage === 'verifying' && <RadarLoader messages={VERIFICATION_MESSAGES} />}

        {stage === 'preview' && spec && (
          <div className="py-2">
            <div
              className="flex items-start gap-4 p-4 rounded-lg"
              style={{
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--muted) / 0.3)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-md shrink-0 overflow-hidden"
                style={{
                  width: 56,
                  height: 56,
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={title}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Sparkles size={22} style={{ color: 'hsl(var(--primary))' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold text-base truncate"
                  style={{ color: 'hsl(var(--foreground))' }}
                >
                  {title || 'Untitled app'}
                </div>
                {description && (
                  <div
                    className="text-sm mt-1"
                    style={{
                      color: 'hsl(var(--muted-foreground))',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {description}
                  </div>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'hsl(var(--primary) / 0.12)',
                    color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.3)',
                  }}
                >
                  {endpointCount} endpoint{endpointCount === 1 ? '' : 's'}
                </div>
              </div>
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

        <DialogFooter>
          {stage === 'idle' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={!input.trim()}>
                <Sparkles size={14} className="mr-1.5" />
                Generate
              </Button>
            </>
          )}
          {(stage === 'generating' || stage === 'verifying') && (
            <Button variant="ghost" disabled>Working…</Button>
          )}
          {stage === 'preview' && (
            <>
              <Button variant="ghost" onClick={reset}>Try another</Button>
              <Button onClick={handleCreate}>
                <Plus size={14} className="mr-1.5" />
                Create app
              </Button>
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
        <Sparkles size={14} className="mr-1.5" style={{ color: 'hsl(var(--primary))' }} />
        {label}
      </Button>
      <AddAppDialog open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  );
};

export default AddAppDialog;
