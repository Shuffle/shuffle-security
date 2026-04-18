import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, FileCode, ExternalLink, ShieldAlert, Info, Clock, Server, Search, Loader2, FolderOpen } from 'lucide-react';
import { getDatastoreItem } from '@/services/datastore';

type EntityType = 'software' | 'package';

interface EntityReferencePageProps {
  type: EntityType;
}

const CONFIG: Record<EntityType, {
  label: string;
  icon: typeof Package;
  category: string;
  buildLinks: (name: string) => { label: string; url: string }[];
}> = {
  software: {
    label: 'Software',
    icon: Package,
    category: 'shuffle-security_sensors',
    buildLinks: (name) => [
      { label: 'NVD (NIST)', url: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(name)}` },
      { label: 'CVE Details', url: `https://www.cvedetails.com/google-search-results.php?q=${encodeURIComponent(name)}` },
      { label: 'OSV.dev', url: `https://osv.dev/list?q=${encodeURIComponent(name)}` },
      { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent(name + ' vulnerability')}` },
    ],
  },
  package: {
    label: 'Package',
    icon: FileCode,
    category: 'shuffle-security_packages',
    buildLinks: (name) => [
      { label: 'NVD (NIST)', url: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(name)}` },
      { label: 'OSV.dev', url: `https://osv.dev/list?q=${encodeURIComponent(name)}` },
      { label: 'Snyk Vulnerability DB', url: `https://security.snyk.io/search?q=${encodeURIComponent(name)}` },
      { label: 'npm', url: `https://www.npmjs.com/package/${encodeURIComponent(name)}` },
      { label: 'PyPI', url: `https://pypi.org/project/${encodeURIComponent(name)}/` },
      { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent(name + ' vulnerability')}` },
    ],
  },
};

interface HostMatch {
  hostname: string;
  path?: string;
  version?: string;
  updatedAt?: number;
}

const safeParse = (raw: unknown): Record<string, unknown> | null => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Expected shape from get_cache:
 * {
 *   name, os, versions: string[],
 *   hostnames: [{ hostname, paths: string[], version, updated_at }, ...]
 * }
 *
 * We expand to one row per (hostname, path) and keep the latest updated_at
 * + version per pair.
 */
const extractMatchesFromValue = (value: unknown): HostMatch[] => {
  if (!value || typeof value !== 'object') return [];
  const obj = value as Record<string, unknown>;
  const hostnames = Array.isArray(obj.hostnames) ? (obj.hostnames as Array<Record<string, unknown>>) : [];
  if (hostnames.length === 0) return [];

  // Deduplicate by hostname + path, keeping the latest updated_at and version.
  const map = new Map<string, HostMatch>();
  for (const entry of hostnames) {
    const hostname = String(entry?.hostname || '').trim();
    if (!hostname) continue;
    const version = entry?.version ? String(entry.version) : undefined;
    const updatedAt = typeof entry?.updated_at === 'number' ? entry.updated_at as number : undefined;
    const paths = Array.isArray(entry?.paths) ? (entry.paths as unknown[]).map(p => String(p)) : [];
    const uniquePaths = paths.length > 0 ? Array.from(new Set(paths)) : [undefined as unknown as string];
    for (const path of uniquePaths) {
      const key = `${hostname}::${path ?? ''}`;
      const existing = map.get(key);
      if (!existing || (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt))) {
        map.set(key, { hostname, path: path || undefined, version, updatedAt });
      }
    }
  }
  // Sort: hostname asc, then path asc
  return Array.from(map.values()).sort((a, b) =>
    a.hostname.localeCompare(b.hostname) || (a.path || '').localeCompare(b.path || '')
  );
};

const EntityReferencePage = ({ type }: EntityReferencePageProps) => {
  const params = useParams();
  const navigate = useNavigate();
  // Use splat param ('*') to capture multi-segment names like '@eslint/js'
  const raw = (params['*'] || params.id || '') as string;
  const name = decodeURIComponent(raw);
  const config = CONFIG[type];
  const Icon = config.icon;
  const referenceLinks = config.buildLinks(name);

  usePageMeta({ title: `${name} — ${config.label}`, description: `${config.label} detail for ${name}` });

  const [matches, setMatches] = useState<HostMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getDatastoreItem(name, config.category);
      if (cancelled) return;
      if (!res.success) {
        setError(res.error || `Failed to load ${name}`);
        setMatches([]);
        setLoading(false);
        return;
      }
      if (!res.item) {
        setMatches([]);
        setLoading(false);
        return;
      }
      const parsed = safeParse(res.item.value);
      const value = parsed ?? res.item.value;
      setMatches(extractMatchesFromValue(value));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [name, config.category, type]);

  const filteredMatches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(m =>
      m.hostname.toLowerCase().includes(q) ||
      (m.path || '').toLowerCase().includes(q) ||
      (m.version || '').toLowerCase().includes(q),
    );
  }, [matches, filter]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 shrink-0">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Icon size={18} className="text-primary shrink-0" />
          <h1 className="text-lg font-semibold text-foreground truncate">{name}</h1>
        </div>
      </div>

      {/* Hosts containing this entity */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-foreground">
            <Server size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Hosts with this {config.label.toLowerCase()}</span>
            {!loading && (
              <span className="text-[0.65rem] text-muted-foreground">({matches.length})</span>
            )}
          </div>
          {matches.length > 0 && (
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter hosts…"
                className="h-7 pl-7 text-xs w-44"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 size={12} className="animate-spin" />
            Searching {config.category}…
          </div>
        ) : error ? (
          <p className="text-xs text-destructive py-2">{error}</p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No hosts found with <span className="font-mono font-medium text-foreground">{name}</span> installed.
          </p>
        ) : filteredMatches.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No hosts match "{filter}".</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Hostname</th>
                  {type === 'package' && <th className="px-3 py-1.5 font-medium">Path</th>}
                  <th className="px-3 py-1.5 font-medium">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMatches.map((m, i) => (
                  <tr
                    key={`${m.hostname}-${m.path || ''}-${i}`}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => navigate(`/monitors/${encodeURIComponent(m.hostname)}`)}
                  >
                    <td className="px-3 py-1.5 font-medium text-foreground">{m.hostname}</td>
                    {type === 'package' && (
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {m.path ? (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <FolderOpen size={10} className="shrink-0" />
                            {m.path}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-muted-foreground font-mono">{m.version || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Version & vulnerability status */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium">Version Status</span>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Check the reference links below to determine if the installed version is current or outdated.
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

export default EntityReferencePage;
