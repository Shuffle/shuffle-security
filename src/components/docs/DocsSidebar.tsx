import { Home as HomeIcon, Settings as SettingsIcon, Server as DnsIcon, Radio as SensorsIcon, ExternalLink as OpenInNewIcon, AlertTriangle as ReportProblemIcon, Radar as RadarIcon, Download as DownloadIcon, FileText as FileTextIcon, ChevronDown as ChevronDownIcon, BookOpen as BookOpenIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { getApiUrl } from '@/Shuffle-MCPs/api';
interface DocLink {
  label: string;
  slug: string;
  icon: React.ReactNode;
  external?: boolean;
  href?: string;
}

interface DocsSidebarProps {
  onNavigate?: () => void;
}

const docLinks: DocLink[] = [
  { label: 'Overview', slug: 'index', icon: <HomeIcon /> },
  { label: 'Getting Started', slug: 'getting-started', icon: <SettingsIcon /> },
  { label: 'Incident Creation', slug: 'incident-creation', icon: <ReportProblemIcon /> },
  { label: 'Shuffle Pipelines', slug: 'shuffle-pipelines', icon: <SensorsIcon /> },
  { label: 'Monitoring', slug: 'monitoring', icon: <RadarIcon /> },
  { label: 'Self-Hosting', slug: 'setup', icon: <DnsIcon /> },
];

const externalLinks: DocLink[] = [
  {
    label: 'Shuffle API Docs',
    slug: 'api',
    icon: <OpenInNewIcon />,
    external: true,
    href: 'https://shuffler.io/docs/API',
  },
  {
    label: 'Shuffle Automation',
    slug: 'shuffle',
    icon: <OpenInNewIcon />,
    external: true,
    href: 'https://shuffler.io',
  },
  {
    label: 'Agent Skill (SHUFFLE_CORE.md)',
    slug: 'shuffle-core-md',
    icon: <DownloadIcon />,
    external: true,
    href: '/SHUFFLE_CORE.md',
  },
];

interface RemoteDoc {
  name: string;
  slug: string;
  label: string;
  read_time?: number;
}

// Slugs already covered by local docs — hide these from the remote fallback list
const LOCAL_SLUGS = new Set(['index', 'getting-started', 'incident-creation', 'shuffle-pipelines', 'monitoring', 'setup']);
// Remote names that map onto our local slugs (avoid duplicates)
const LOCAL_REMOTE_ALIASES = new Set(['getting_started']);

const toLabel = (name: string) =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const DocsSidebar = ({ onNavigate }: DocsSidebarProps) => {
  const { slug = 'index' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [remoteDocs, setRemoteDocs] = useState<RemoteDoc[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/docs'));
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.list)) return;
        const mapped: RemoteDoc[] = data.list
          .filter((d: { name?: string }) => d?.name && !LOCAL_REMOTE_ALIASES.has(d.name))
          .map((d: { name: string; read_time?: number }) => {
            const s = d.name.replace(/_/g, '-').toLowerCase();
            return { name: d.name, slug: s, label: toLabel(d.name), read_time: d.read_time };
          })
          .filter((d: RemoteDoc) => !LOCAL_SLUGS.has(d.slug))
          .sort((a: RemoteDoc, b: RemoteDoc) => a.label.localeCompare(b.label));
        if (!cancelled) setRemoteDocs(mapped);
      } catch {
        // Silent fail — remote docs are a nice-to-have
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleClick = () => {
    onNavigate?.();
  };


  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        height: '100%',
        overflowY: 'auto',
        py: 3,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          px: 3,
          color: 'text.secondary',
          fontWeight: 600,
          letterSpacing: 1.5,
        }}
      >
        Documentation
      </Typography>
      
      <List sx={{ px: 1, mt: 1 }}>
        {docLinks.map((link) => (
          <ListItem key={link.slug} disablePadding>
            <ListItemButton
              component={Link}
              to={link.slug === 'index' ? '/docs' : `/docs/${link.slug}`}
              onClick={handleClick}
              selected={slug === link.slug || (slug === 'index' && link.slug === 'index')}
              sx={{
                borderRadius: 1,
                mx: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 102, 0, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 102, 0, 0.15)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                {link.icon}
              </ListItemIcon>
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {remoteDocs.length > 0 && (
        <>
          <Typography
            variant="overline"
            sx={{
              px: 3,
              mt: 4,
              display: 'block',
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: 1.5,
            }}
          >
            Reference
          </Typography>
          <List sx={{ px: 1, mt: 1 }}>
            {remoteDocs.map((doc) => (
              <ListItem key={doc.slug} disablePadding>
                <ListItemButton
                  component={Link}
                  to={`/docs/${doc.slug}`}
                  onClick={handleClick}
                  selected={slug === doc.slug}
                  sx={{
                    borderRadius: 1,
                    mx: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(255, 102, 0, 0.1)',
                      '&:hover': { backgroundColor: 'rgba(255, 102, 0, 0.15)' },
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                      '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 600 },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                    <FileTextIcon size={18} />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.label}
                    primaryTypographyProps={{ fontSize: '0.875rem' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}


      <Typography
        variant="overline"
        sx={{
          px: 3,
          mt: 4,
          display: 'block',
          color: 'text.secondary',
          fontWeight: 600,
          letterSpacing: 1.5,
        }}
      >
        External Resources
      </Typography>

      <List sx={{ px: 1, mt: 1 }}>
        {externalLinks.map((link) => (
          <ListItem key={link.slug} disablePadding>
            <ListItemButton
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderRadius: 1,
                mx: 1,
                py: 1,
                gap: 0.5,
                color: 'text.secondary',
                transition: 'background-color 120ms ease, color 120ms ease',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  color: 'text.primary',
                  '& .MuiListItemIcon-root, & .ext-indicator': {
                    color: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                {link.icon}
              </ListItemIcon>
              <ListItemText
                primary={link.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  sx: { color: 'inherit' },
                }}
              />
              <OpenInNewIcon
                className="ext-indicator"
                size={14} style={{ color: 'text.disabled', marginLeft: '8px', flexShrink: 0, transition: 'color 120ms ease' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
