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
import { getApiUrl } from '@/config/api';
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
        const response = await fetch(getApiUrl('/users/getusers'), {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
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

    if (sessionToken) {
      fetchUsers();
    }
  }, [sessionToken]);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 4 }}>
        Users
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Organizations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No users found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          {user.username?.charAt(0).toUpperCase() || '?'}
                        </Avatar>
                        <Typography variant="body2">{user.username}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role || 'user'}
                        size="small"
                        color={user.role === 'admin' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.active !== false ? 'Active' : 'Inactive'}
                        size="small"
                        color={user.active !== false ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
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
