import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, FileCode, ExternalLink, ShieldAlert, Info, Clock, Server, Search, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';
import { getDatastoreItem } from '@/services/datastore';
import { getApiUrl, shuffleFetch } from '@/config/api';

type EntityType = 'software' | 'package';

interface EntityReferencePageProps {
  type: EntityType;
}

/**
 * Map a programming language / ecosystem identifier (as reported in the
 * datastore `os` field for packages) to its canonical registry. Used for
 * both the registry deep-link and the language logo.
 *
 * Logos come from Simple Icons CDN — no extra deps, themable via currentColor.
 */
interface LanguageInfo {
  label: string;           // Display name (e.g. "Python")
  registryLabel: string;   // Registry name (e.g. "PyPI")
  registryUrl: (name: string) => string;
  /** Simple Icons slug — see https://simpleicons.org/ */
  iconSlug: string;
  /** Hex color (no `#`) for the logo background tint */
  color: string;
}

const LANGUAGE_REGISTRY: Record<string, LanguageInfo> = {
  javascript: { label: 'JavaScript', registryLabel: 'npm', registryUrl: n => `https://www.npmjs.com/package/${encodeURIComponent(n)}`, iconSlug: 'npm', color: 'CB3837' },
  typescript: { label: 'TypeScript', registryLabel: 'npm', registryUrl: n => `https://www.npmjs.com/package/${encodeURIComponent(n)}`, iconSlug: 'npm', color: 'CB3837' },
  node: { label: 'Node.js', registryLabel: 'npm', registryUrl: n => `https://www.npmjs.com/package/${encodeURIComponent(n)}`, iconSlug: 'npm', color: 'CB3837' },
  npm: { label: 'npm', registryLabel: 'npm', registryUrl: n => `https://www.npmjs.com/package/${encodeURIComponent(n)}`, iconSlug: 'npm', color: 'CB3837' },
  python: { label: 'Python', registryLabel: 'PyPI', registryUrl: n => `https://pypi.org/project/${encodeURIComponent(n)}/`, iconSlug: 'pypi', color: '3775A9' },
  pypi: { label: 'Python', registryLabel: 'PyPI', registryUrl: n => `https://pypi.org/project/${encodeURIComponent(n)}/`, iconSlug: 'pypi', color: '3775A9' },
  ruby: { label: 'Ruby', registryLabel: 'RubyGems', registryUrl: n => `https://rubygems.org/gems/${encodeURIComponent(n)}`, iconSlug: 'rubygems', color: 'E9573F' },
  go: { label: 'Go', registryLabel: 'pkg.go.dev', registryUrl: n => `https://pkg.go.dev/${encodeURIComponent(n)}`, iconSlug: 'go', color: '00ADD8' },
  golang: { label: 'Go', registryLabel: 'pkg.go.dev', registryUrl: n => `https://pkg.go.dev/${encodeURIComponent(n)}`, iconSlug: 'go', color: '00ADD8' },
  rust: { label: 'Rust', registryLabel: 'crates.io', registryUrl: n => `https://crates.io/crates/${encodeURIComponent(n)}`, iconSlug: 'rust', color: 'DEA584' },
  java: { label: 'Java', registryLabel: 'Maven Central', registryUrl: n => `https://central.sonatype.com/search?q=${encodeURIComponent(n)}`, iconSlug: 'openjdk', color: 'ED8B00' },
  maven: { label: 'Java', registryLabel: 'Maven Central', registryUrl: n => `https://central.sonatype.com/search?q=${encodeURIComponent(n)}`, iconSlug: 'apachemaven', color: 'C71A36' },
  kotlin: { label: 'Kotlin', registryLabel: 'Maven Central', registryUrl: n => `https://central.sonatype.com/search?q=${encodeURIComponent(n)}`, iconSlug: 'kotlin', color: '7F52FF' },
  php: { label: 'PHP', registryLabel: 'Packagist', registryUrl: n => `https://packagist.org/packages/${encodeURIComponent(n)}`, iconSlug: 'php', color: '777BB4' },
  composer: { label: 'PHP', registryLabel: 'Packagist', registryUrl: n => `https://packagist.org/packages/${encodeURIComponent(n)}`, iconSlug: 'composer', color: '885630' },
  dotnet: { label: '.NET', registryLabel: 'NuGet', registryUrl: n => `https://www.nuget.org/packages/${encodeURIComponent(n)}`, iconSlug: 'nuget', color: '004880' },
  csharp: { label: 'C#', registryLabel: 'NuGet', registryUrl: n => `https://www.nuget.org/packages/${encodeURIComponent(n)}`, iconSlug: 'nuget', color: '004880' },
  swift: { label: 'Swift', registryLabel: 'Swift Package Index', registryUrl: n => `https://swiftpackageindex.com/search?query=${encodeURIComponent(n)}`, iconSlug: 'swift', color: 'F05138' },
  dart: { label: 'Dart', registryLabel: 'pub.dev', registryUrl: n => `https://pub.dev/packages/${encodeURIComponent(n)}`, iconSlug: 'dart', color: '0175C2' },
  elixir: { label: 'Elixir', registryLabel: 'Hex', registryUrl: n => `https://hex.pm/packages/${encodeURIComponent(n)}`, iconSlug: 'elixir', color: '4B275F' },
};

const getLanguageInfo = (os?: string): LanguageInfo | null => {
  if (!os) return null;
  return LANGUAGE_REGISTRY[os.toLowerCase().trim()] || null;
};

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
    // Note: language-specific registry link is injected dynamically via os field.
    buildLinks: (name) => [
      { label: 'NVD (NIST)', url: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(name)}` },
      { label: 'OSV.dev', url: `https://osv.dev/list?q=${encodeURIComponent(name)}` },
      { label: 'Snyk Vulnerability DB', url: `https://security.snyk.io/search?q=${encodeURIComponent(name)}` },
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

  usePageMeta({ title: `${name} — ${config.label}`, description: `${config.label} detail for ${name}` });

  const [matches, setMatches] = useState<HostMatch[]>([]);
  const [os, setOs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setOs(null);
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
      if (value && typeof value === 'object' && 'os' in value && typeof (value as Record<string, unknown>).os === 'string') {
        setOs((value as Record<string, unknown>).os as string);
      }
      setMatches(extractMatchesFromValue(value));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [name, config.category, type]);

  const language = type === 'package' ? getLanguageInfo(os || undefined) : null;

  // Build reference links: prepend language registry link when known, dedupe by URL.
  const referenceLinks = useMemo(() => {
    const base = config.buildLinks(name);
    if (!language) return base;
    const registryLink = { label: language.registryLabel, url: language.registryUrl(name) };
    const seen = new Set<string>([registryLink.url]);
    return [registryLink, ...base.filter(l => !seen.has(l.url) && (seen.add(l.url), true))];
  }, [config, name, language]);

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
          {language && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[0.65rem] font-medium text-foreground shrink-0"
              title={`${language.label} — ${language.registryLabel}`}
            >
              <img
                src={`https://cdn.simpleicons.org/${language.iconSlug}/${language.color}`}
                alt=""
                width={12}
                height={12}
                loading="lazy"
                className="shrink-0"
              />
              {language.label}
            </span>
          )}
          {!language && os && (
            <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground shrink-0">
              {os}
            </span>
          )}
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
