import { Link, useParams } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface DocLink {
  label: string;
  slug: string;
  icon: React.ReactNode;
  external?: boolean;
  href?: string;
}

const docLinks: DocLink[] = [
  { label: 'Overview', slug: 'index', icon: <HomeIcon /> },
  { label: 'Setup Guide', slug: 'setup', icon: <SettingsIcon /> },
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
];

export const DocsSidebar = () => {
  const { slug = 'index' } = useParams<{ slug: string }>();

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
    </Box>
  );
};
