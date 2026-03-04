/**
 * InlineAppSearch — Inline search dropdown combining Algolia + /api/v1/apps results.
 * Used in the UsecaseAlluvialDiagram when clicking "+" to add a tool.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  InputAdornment,
  ClickAwayListener,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Search, X } from 'lucide-react';
import { algoliasearch } from 'algoliasearch';
import { getApiUrl, getAuthHeader } from '@/config/api';
import type { AlgoliaSearchApp } from '@/lib/singul-local';
import { useNavigate } from 'react-router-dom';

const ALGOLIA_APP_ID = 'JNSS5CFDZZ';
const ALGOLIA_API_KEY = 'c8f882473ff42d41158430be09ec2b4e';
const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

interface LocalApp {
  id: string;
  name: string;
  large_image?: string;
  activated?: boolean;
}

interface MergedApp {
  id: string;
  name: string;
  image: string;
  source: 'algolia' | 'api' | 'both';
  activated?: boolean;
}

interface InlineAppSearchProps {
  onClose: () => void;
  /** Position anchor — 'left' or 'right' column */
  side: 'left' | 'right';
  /** Optional category filter hint (e.g. 'siem', 'edr') */
  categoryHint?: string;
}

export default function InlineAppSearch({ onClose, side, categoryHint }: InlineAppSearchProps) {
  const [query, setQuery] = useState(categoryHint || '');
  const [algoliaResults, setAlgoliaResults] = useState<AlgoliaSearchApp[]>([]);
  const [apiResults, setApiResults] = useState<LocalApp[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // Focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Fetch /api/v1/apps once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/apps'), {
          credentials: 'include',
          headers: getAuthHeader(),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setApiResults(data);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Search Algolia on query change
  const searchAlgolia = useCallback(async (q: string) => {
    if (!q.trim()) {
      setAlgoliaResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await algoliaClient.searchSingleIndex({
        indexName: 'appsearch',
        searchParams: { query: q, hitsPerPage: 12 },
      });
      setAlgoliaResults(res.hits as AlgoliaSearchApp[]);
    } catch {
      setAlgoliaResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAlgolia(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchAlgolia]);

  // Merge results: Algolia first, then API apps not already in Algolia
  const merged: MergedApp[] = (() => {
    const seen = new Set<string>();
    const items: MergedApp[] = [];

    for (const app of algoliaResults) {
      const key = app.name.toLowerCase();
      seen.add(key);
      items.push({
        id: app.objectID,
        name: app.name,
        image: app.image_url || '',
        source: 'algolia',
      });
    }

    // Filter API apps by query
    const q = query.toLowerCase();
    for (const app of apiResults) {
      const key = (app.name || '').toLowerCase();
      if (!key) continue;
      if (q && !key.includes(q)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: app.id,
        name: app.name,
        image: app.large_image || '',
        source: 'api',
        activated: app.activated,
      });
    }

    return items.slice(0, 15);
  })();

  const handleSelect = (app: MergedApp) => {
    onClose();
    navigate(`/apps/${encodeURIComponent(app.name)}`);
  };

  return (
    <ClickAwayListener onClickAway={onClose}>
      <Box
        sx={{
          position: 'absolute',
          [side === 'left' ? 'left' : 'right']: 0,
          top: 0,
          width: 300,
          bgcolor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 2,
          boxShadow: '0 8px 32px hsl(var(--background) / 0.6)',
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid hsl(var(--border))' }}>
          <TextField
            inputRef={inputRef}
            size="small"
            fullWidth
            placeholder="Search integrations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.85rem',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                </InputAdornment>
              ),
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={14} sx={{ color: 'hsl(var(--muted-foreground))' }} />
                </InputAdornment>
              ) : query ? (
                <InputAdornment position="end">
                  <Box
                    component="button"
                    onClick={() => setQuery('')}
                    sx={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))',
                      display: 'flex',
                      p: 0,
                    }}
                  >
                    <X size={14} />
                  </Box>
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {/* Results */}
        <Box
          sx={{
            maxHeight: 320,
            overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'hsl(var(--muted-foreground) / 0.3)',
              borderRadius: 2,
            },
          }}
        >
          {merged.length === 0 && !loading && (
            <Typography
              sx={{
                p: 3,
                textAlign: 'center',
                color: 'hsl(var(--muted-foreground))',
                fontSize: '0.8rem',
              }}
            >
              {query ? 'No integrations found' : 'Type to search integrations'}
            </Typography>
          )}

          {merged.map((app) => (
            <Box
              key={app.id}
              onClick={() => handleSelect(app)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                cursor: 'pointer',
                transition: 'background 0.1s',
                '&:hover': {
                  bgcolor: 'hsl(var(--muted))',
                },
              }}
            >
              {app.image ? (
                <Box
                  component="img"
                  src={app.image}
                  alt={app.name}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'contain',
                    bgcolor: 'hsl(var(--muted))',
                    p: 0.25,
                    flexShrink: 0,
                  }}
                  onError={(e: any) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.7rem',
                    bgcolor: 'hsl(var(--muted))',
                    color: 'hsl(var(--foreground))',
                    flexShrink: 0,
                  }}
                >
                  {app.name.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'hsl(var(--foreground))',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {app.name}
                </Typography>
              </Box>
              {app.activated && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'hsl(var(--severity-low))',
                    flexShrink: 0,
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </ClickAwayListener>
  );
}
