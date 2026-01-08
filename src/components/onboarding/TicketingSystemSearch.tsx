import { useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { Mail, Shield, Search, Globe } from 'lucide-react';
import { SingulJS } from '@/lib/singul-local';
import type { AlgoliaSearchApp, SingulJSHandle } from '@/lib/singul-local';
import { API_CONFIG } from '@/config/api';

interface TicketingSystemSearchProps {
  selectedApps: AlgoliaSearchApp[];
  onAppsChange: (apps: AlgoliaSearchApp[]) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const TicketingSystemSearch = ({ 
  selectedApps,
  onAppsChange,
  searchQuery,
  onSearchQueryChange,
}: TicketingSystemSearchProps) => {
  const singulRef = useRef<SingulJSHandle>(null);

  const categories = [
    { id: 'email', label: 'Email', icon: Mail, description: 'Gmail, Outlook, Exchange', searchTerm: 'email' },
    { id: 'siem', label: 'SIEM', icon: Shield, description: 'Splunk, Sentinel, QRadar', searchTerm: 'siem' },
    { id: 'edr', label: 'EDR', icon: Search, description: 'CrowdStrike, Carbon Black', searchTerm: 'edr' },
    { id: 'other', label: 'Anywhere Else', icon: Globe, description: 'Any other source', searchTerm: '' },
  ];

  const getActiveCategory = () => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    if (lowerQuery === '') return 'other';
    return categories.find(c => c.searchTerm && c.searchTerm.toLowerCase() === lowerQuery)?.id || null;
  };

  const activeCategory = getActiveCategory();

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          color: 'white',
          fontWeight: 700,
          mb: 1,
        }}
      >
        Connect Your Alert Sources
      </Typography>
      <Typography
        variant="body1"
        sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 4 }}
      >
        Search and connect integrations from any of these ingest areas.
      </Typography>

      {/* Ingest Area Categories */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 4,
        }}
      >
        {categories.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <Box
              key={category.id}
              sx={{
                p: 3,
                backgroundColor: isActive ? 'rgba(255, 102, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid',
                borderColor: isActive ? '#FF6600' : 'rgba(255, 255, 255, 0.08)',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textAlign: 'center',
                '&:hover': {
                  borderColor: 'rgba(255, 102, 0, 0.5)',
                  backgroundColor: isActive ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                },
              }}
              onClick={() => {
                const term = category.searchTerm || '';
                onSearchQueryChange(term);
                if (singulRef.current) {
                  singulRef.current.search(term);
                }
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  border: '2px solid',
                  borderColor: isActive ? '#FF6600' : 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5,
                  transition: 'all 0.3s ease',
                }}
              >
                <category.icon size={22} color={isActive ? '#FF6600' : 'rgba(255, 255, 255, 0.6)'} />
              </Box>
              <Typography
                variant="subtitle1"
                sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}
              >
                {category.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}
              >
                {category.description}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <SingulJS
        ref={singulRef}
        authToken="demo-token"
        apiKey={API_CONFIG.apiKey || undefined}
        apiBaseUrl={API_CONFIG.baseUrl}
        placeholder="Search all available integrations..."
        layout="grid"
        gridColumns={3}
        inline={true}
        initialQuery="email"
        hitsPerPage={39}
        showDescription={true}
        showCategories={true}
        showCheckbox={true}
        multiSelect={true}
        preventDefault={true}
        selectedApps={selectedApps}
        onSelectionChange={(apps) => {
          onAppsChange(apps);
        }}
        onSearchChange={(query) => {
          onSearchQueryChange(query);
        }}
        customStyles={{
          container: { 
            width: '100%',
          },
          inputWrapper: {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          input: {
            backgroundColor: 'transparent',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
          },
          searchIcon: {
            color: 'rgba(255, 255, 255, 0.4)',
          },
          spinner: {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderTopColor: '#FF6600',
          },
          resultsContainer: {
            marginTop: '16px',
            gap: '12px',
          },
          dropdownItem: {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          },
          dropdownItemHover: {
            borderColor: 'rgba(255, 102, 0, 0.5)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            transform: 'translateY(-2px)',
          },
          selectedItem: {
            backgroundColor: 'rgba(255, 102, 0, 0.1)',
            borderColor: '#FF6600',
          },
          appInfo: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          },
          appIcon: {
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            objectFit: 'contain' as const,
            padding: '4px',
          },
          appDetails: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '4px',
            flex: 1,
          },
          appName: {
            fontSize: '14px',
            fontWeight: 600,
            color: 'white',
          },
          appDescription: {
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            lineHeight: 1.4,
          },
          appCategory: {
            marginTop: '8px',
            padding: '2px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
            borderRadius: '4px',
            display: 'inline-block',
            width: 'fit-content',
          },
          checkbox: {
            border: '2px solid rgba(255, 255, 255, 0.2)',
          },
          checkboxChecked: {
            backgroundColor: '#FF6600',
            borderColor: '#FF6600',
          },
          emptyState: {
            padding: '32px',
            color: 'rgba(255, 255, 255, 0.4)',
            textAlign: 'center' as const,
            fontSize: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            gridColumn: '1 / -1',
          },
        }}
      />

      {/* Selected Apps Display */}
      {selectedApps.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}
          >
            Selected integrations ({selectedApps.length}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedApps.map((app) => (
              <Chip
                key={app.objectID}
                label={app.name.replace(/_/g, ' ')}
                avatar={
                  app.image_url ? (
                    <Box
                      component="img"
                      src={app.image_url} 
                      alt={app.name}
                      sx={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: '50%',
                        objectFit: 'contain',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    />
                  ) : undefined
                }
                onDelete={() => {
                  onAppsChange(selectedApps.filter(a => a.objectID !== app.objectID));
                }}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: 500,
                  '& .MuiChip-avatar': {
                    marginLeft: '4px',
                  },
                  '& .MuiChip-deleteIcon': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&:hover': { color: 'white' },
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
