import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import { getApiUrl, getAuthHeader } from '@/config/api';
import { useAuth } from '@/context/AuthContext';

interface User {
  id: string;
  username: string;
  role: string;
  active: boolean;
  orgs?: string[];
  created_at?: number;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sessionToken } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(getApiUrl('/getusers'), {
          credentials: 'include',
          headers: {
            ...getAuthHeader(sessionToken),
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.reason || 'Failed to fetch users');
        }

        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [sessionToken]);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 4, color: 'hsl(var(--foreground))' }}>
        Users
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>User</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Role</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Status</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Organizations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: 'hsl(var(--muted-foreground))' }}>
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'hsl(var(--primary))', width: 32, height: 32 }}>
                          {user.username?.charAt(0).toUpperCase() || '?'}
                        </Avatar>
                        <Typography variant="body2" sx={{ color: 'hsl(var(--foreground))' }}>
                          {user.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role || 'user'}
                        size="small"
                        sx={{
                          bgcolor: user.role === 'admin' ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                          color: user.role === 'admin' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.active !== false ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          bgcolor: user.active !== false ? 'hsla(142, 76%, 36%, 0.2)' : 'hsl(var(--muted))',
                          color: user.active !== false ? 'hsl(142, 76%, 36%)' : 'hsl(var(--muted-foreground))',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                        {user.orgs?.length || 1}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default UsersPage;
