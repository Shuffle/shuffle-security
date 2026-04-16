import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCode, ExternalLink, ShieldAlert, Info, Clock } from 'lucide-react';

const PackageDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const name = decodeURIComponent(id || '');

  usePageMeta({ title: `${name} — Package`, description: `Package detail for ${name}` });

  const referenceLinks = [
    { label: 'NVD (NIST)', url: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(name)}` },
    { label: 'OSV.dev', url: `https://osv.dev/list?q=${encodeURIComponent(name)}` },
    { label: 'Snyk Vulnerability DB', url: `https://security.snyk.io/search?q=${encodeURIComponent(name)}` },
    { label: 'npm', url: `https://www.npmjs.com/package/${encodeURIComponent(name)}` },
    { label: 'PyPI', url: `https://pypi.org/project/${encodeURIComponent(name)}/` },
    { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent(name + ' vulnerability')}` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 shrink-0">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <FileCode size={18} className="text-primary shrink-0" />
          <h1 className="text-lg font-semibold text-foreground truncate">{name}</h1>
        </div>
      </div>

      {/* Version & vulnerability status */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Version Status</span>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Check the reference links below to determine if the installed version is current or outdated. Cross-reference with the host's package list in the Monitors view.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <ShieldAlert size={14} className="text-orange-500" />
            <span className="text-sm font-medium">Vulnerability Check</span>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Search for known CVEs and advisories related to <span className="font-mono font-medium text-foreground">{name}</span> using the databases below.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Info size={14} className="text-blue-500" />
            <span className="text-sm font-medium">Reference Links</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
            {referenceLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
              >
                <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageDetailPage;
