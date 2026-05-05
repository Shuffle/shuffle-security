import { Box, Typography, Container } from '@mui/material';
import { ShuffleMCP } from '@/Shuffle-MCPs/ShuffleMCP';
import { useAuth } from '@/context/AuthContext';

/**
 * Demo page for the shuffle-mcps library — uses ONLY the default setup.
 * No onAppSelected, no preventDefault, no custom rendering. Clicking an app
 * opens the built-in detail drawer with existing authentications.
 */
const ShuffleMcpTestPage = () => {
  const { userInfo } = useAuth();
  const apiKey = userInfo?.apikey || '';
  const orgId = userInfo?.active_org?.id;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Shuffle MCP — default demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This page renders <code>&lt;ShuffleMCP /&gt;</code> with nothing but{' '}
          <code>apiKey</code> and <code>orgId</code>. Clicking a result opens
          the built-in detail drawer.
        </Typography>
      </Box>

      <ShuffleMCP
        apiKey={apiKey}
        orgId={orgId}
        inline
        layout="grid"
        gridColumns={3}
      />
    </Container>
  );
};

export default ShuffleMcpTestPage;
