/**
 * Renders an action's stdout. Most actions return text and we show it in a
 * <pre>. The `script:screenshot` action returns a base64-encoded PNG which
 * we detect by signature and render as an inline image instead.
 */
import { useMemo, useState } from 'react';

const IMAGE_SIGNATURES: Array<{ prefix: string; mime: string }> = [
  { prefix: 'iVBORw0KGgo', mime: 'image/png' },   // PNG
  { prefix: '/9j/',        mime: 'image/jpeg' },  // JPEG
  { prefix: 'R0lGOD',      mime: 'image/gif' },   // GIF
  { prefix: 'UklGR',       mime: 'image/webp' },  // WebP
];

const matchSignature = (compact: string): { mime: string; b64: string } | null => {
  if (compact.length < 200) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return null;
  for (const sig of IMAGE_SIGNATURES) {
    if (compact.startsWith(sig.prefix)) return { mime: sig.mime, b64: compact };
  }
  return null;
};

const detectImage = (raw: string): { mime: string; b64: string } | null => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim().replace(/^["']|["']$/g, '');

  // data: URI
  const dataMatch = s.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (dataMatch) return { mime: dataMatch[1], b64: dataMatch[2].replace(/\s+/g, '') };

  // Plain base64 blob
  const compact = s.replace(/\s+/g, '');
  const direct = matchSignature(compact);
  if (direct) return direct;

  // JSON wrapper, e.g. [{ "image": "<base64>", ... }] or { "image": "..." }
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const keys = ['image', 'screenshot', 'data', 'png', 'jpeg', 'jpg', 'b64', 'base64'];
      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue;
        for (const key of keys) {
          const v = (item as Record<string, unknown>)[key];
          if (typeof v !== 'string') continue;
          const inner = v.trim().replace(/\s+/g, '');
          const dm = inner.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
          if (dm) return { mime: dm[1], b64: dm[2] };
          const sig = matchSignature(inner);
          if (sig) return sig;
        }
      }
    } catch {
      // truncated/invalid JSON — fall through to regex extraction
    }
  }

  // Last-resort regex: pull a base64-looking blob out of any wrapper text
  // (handles truncated JSON, partial logs, etc.)
  const regexMatch = s.match(/"(?:image|screenshot|data|png|jpeg|jpg|b64|base64)"\s*:\s*"([A-Za-z0-9+/=\s]{200,})"?/i);
  if (regexMatch) {
    const inner = regexMatch[1].replace(/\s+/g, '');
    const sig = matchSignature(inner);
    if (sig) return sig;
  }

  return null;
};

const MAX_TEXT_CHARS = 4000;

interface ActionOutputViewProps {
  output: string;
  /** Tailwind classes for the <pre> fallback (so each call site keeps its own sizing). */
  className?: string;
}

export const ActionOutputView = ({ output, className }: ActionOutputViewProps) => {
  const detected = useMemo(() => detectImage(output), [output]);
  const [zoomed, setZoomed] = useState(false);
  const [showFull, setShowFull] = useState(false);

  if (detected) {
    const src = `data:${detected.mime};base64,${detected.b64}`;
    return (
      <>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="block max-w-[50%] rounded border border-border overflow-hidden bg-muted/30 hover:border-primary transition-colors"
        >
          <img src={src} alt="Action screenshot" className="w-full h-auto block" />
        </button>
        {zoomed && (
          <div
            className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setZoomed(false)}
          >
            <img src={src} alt="Action screenshot" className="max-w-full max-h-full rounded shadow-2xl" />
          </div>
        )}
      </>
    );
  }

  const isHuge = !!output && output.length > MAX_TEXT_CHARS;
  const display = !isHuge || showFull
    ? output
    : `${output.slice(0, MAX_TEXT_CHARS)}\n\n… [truncated ${output.length - MAX_TEXT_CHARS} chars to keep the page responsive]`;

  return (
    <>
      <pre className={className}>{display}</pre>
      {isHuge && (
        <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-muted-foreground">
          <span>{(output.length / 1024).toFixed(1)} KB output</span>
          <button
            type="button"
            onClick={() => setShowFull(v => !v)}
            className="underline hover:text-foreground"
          >
            {showFull ? 'Collapse' : 'Show full'}
          </button>
        </div>
      )}
    </>
  );
};
