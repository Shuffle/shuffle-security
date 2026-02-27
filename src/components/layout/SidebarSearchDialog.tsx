/**
 * SidebarSearchDialog — Ctrl+K powered search popup for the sidebar.
 * Searches apps via Algolia + local nav items.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { algoliasearch } from 'algoliasearch';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Box, Typography, InputBase, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RadarIcon from '@mui/icons-material/Radar';
import { Network, Braces, Waypoints } from 'lucide-react';
import type { AlgoliaSearchApp } from '@/lib/singul-local/singul.helpers';

const ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const ALGOLIA_API_KEY = 'c8f882473ff42d41158430be09ec2b4e';

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

interface NavResult {
  type: 'nav';
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface AppResult {
  type: 'app';
  app: AlgoliaSearchApp;
}

type SearchResult = NavResult | AppResult;

const navItems: NavResult[] = [
  { type: 'nav', label: 'Incidents', path: '/incidents', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Templates', path: '/templates', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'IOC Types', path: '/incidents/ioc-types', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Threat Feeds', path: '/incidents/threat-feeds', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Custom Fields', path: '/incidents/custom-fields', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Detection', path: '/detection', icon: <RadarIcon sx={{ fontSize: 18 }} /> },
  { type: 'nav', label: 'Sigma Rules', path: '/detection/sigma', icon: <Braces size={16} /> },
  { type: 'nav', label: 'MITRE ATT&CK', path: '/detection/mitre', icon: <Waypoints size={16} /> },
  { type: 'nav', label: 'Infrastructure', path: '/infrastructure', icon: <Network size={16} /> },
  { type: 'nav', label: 'Settings', path: '/settings', icon: <WarningAmberIcon sx={{ fontSize: 18 }} /> },
];

interface SidebarSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SidebarSearchDialog = ({ open, onOpenChange }: SidebarSearchDialogProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [appResults, setAppResults] = useState<AlgoliaSearchApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filter nav items by query
  const filteredNav: NavResult[] = query.trim()
    ? navItems.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  // Combined results: nav first, then apps
  const results: SearchResult[] = [
    ...filteredNav,
    ...appResults.map((app) => ({ type: 'app' as const, app })),
  ];

  // Search Algolia
  const searchApps = useCallback(async (q: string) => {
    if (!q.trim()) {
      setAppResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await client.searchSingleIndex({
        indexName: 'appsearch',
        searchParams: { query: q, hitsPerPage: 8 },
      });
      setAppResults(res.hits as AlgoliaSearchApp[]);
    } catch {
      setAppResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchApps(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchApps]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setAppResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'nav') {
      navigate(result.path);
    } else {
      navigate(`/apps?app=${result.app.name}`);
    }
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          width: 520,
          minWidth: 520,
          maxWidth: 520,
          minHeight: 400,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <SearchIcon sx={{ color: 'hsl(var(--muted-foreground))', fontSize: 20 }} />
          <InputBase
            inputRef={inputRef}
            placeholder="Search pages, apps, integrations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            sx={{
              color: 'hsl(var(--foreground))',
              fontSize: '0.9rem',
              '& input::placeholder': { color: 'hsl(var(--muted-foreground))', opacity: 1 },
            }}
          />
          {loading && <CircularProgress size={16} sx={{ color: 'hsl(var(--primary))' }} />}
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'monospace',
              border: '1px solid hsl(var(--border))',
              borderRadius: 0.5,
              px: 0.75,
              py: 0.25,
              flexShrink: 0,
            }}
          >
            ESC
          </Typography>
        </Box>

        {/* Results */}
        <Box sx={{ overflowY: 'auto', maxHeight: '55vh' }}>
          {/* Nav section */}
          {filteredNav.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Pages
              </Typography>
              {filteredNav.map((item, idx) => {
                const globalIdx = idx;
                return (
                  <Box
                    key={item.path}
                    onClick={() => handleSelect(item)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    <Box sx={{ color: 'hsl(var(--muted-foreground))', display: 'flex' }}>{item.icon}</Box>
                    <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>{item.label}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Apps section */}
          {appResults.length > 0 && (
            <Box sx={{ px: 1.5, pt: 1.5, pb: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: 1, px: 1, mb: 0.5 }}>
                Integrations
              </Typography>
              {appResults.map((app, idx) => {
                const globalIdx = filteredNav.length + idx;
                return (
                  <Box
                    key={app.objectID}
                    onClick={() => handleSelect({ type: 'app', app })}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: selectedIndex === globalIdx ? 'hsl(var(--muted))' : 'transparent',
                      '&:hover': { backgroundColor: 'hsl(var(--muted))', opacity: 0.9 },
                    }}
                  >
                    {app.image_url ? (
                      <img
                        src={app.image_url}
                        alt={app.name}
                        style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', backgroundColor: 'rgba(255,255,255,0.05)', padding: 2 }}
                      />
                    ) : (
                      <Box sx={{ width: 20, height: 20, borderRadius: 0.5, backgroundColor: 'hsl(var(--muted))' }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', textTransform: 'capitalize' }}>
                        {app.name.replace(/_/g, ' ')}
                      </Typography>
                    </Box>
                    {app.categories?.[0] && (
                      <Typography sx={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', flexShrink: 0 }}>
                        {app.categories[0]}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Empty state */}
          {query.trim() && filteredNav.length === 0 && appResults.length === 0 && !loading && (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
                No results for "{query}"
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
