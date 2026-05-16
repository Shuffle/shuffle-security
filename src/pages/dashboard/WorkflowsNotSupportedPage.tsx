import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shuffle Security does not host the workflow editor — that lives in
 * Shuffle Core (shuffler.io). This page explains that and deep-links the
 * user across to the matching URL on Shuffle Core.
 */
const SHUFFLE_CORE_BASE = 'https://shuffler.io';
const AUTO_REDIRECT_MS = 4000;

export default function WorkflowsNotSupportedPage() {
  const { id } = useParams<{ id?: string }>();
  const targetUrl = useMemo(
    () => (id ? `${SHUFFLE_CORE_BASE}/workflows/${id}` : `${SHUFFLE_CORE_BASE}/workflows`),
    [id],
  );

  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_REDIRECT_MS / 1000));

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    const redirect = setTimeout(() => {
      window.location.href = targetUrl;
    }, AUTO_REDIRECT_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [targetUrl]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Workflow size={28} className="text-muted-foreground" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Workflows live in Shuffle Core
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          The workflow editor is not part of Shuffle Security. It is provided by
          Shuffle Core, the upstream automation platform. We are opening{' '}
          <span className="font-mono text-foreground">{targetUrl.replace(SHUFFLE_CORE_BASE, '')}</span>{' '}
          on <span className="font-medium text-foreground">shuffler.io</span> for you
          {secondsLeft > 0 ? ` in ${secondsLeft}s` : ' now'}.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-9">
            <a href={targetUrl} rel="noopener noreferrer">
              <ExternalLink size={16} className="mr-2" />
              Open in Shuffle Core
            </a>
          </Button>
          <Button asChild variant="outline" className="h-9">
            <Link to="/dashboard">
              <ArrowLeft size={16} className="mr-2" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
