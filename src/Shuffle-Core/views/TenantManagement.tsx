// @ts-nocheck
/**
 * TenantManagement — standalone Shuffle-Core surface for managing sub-tenants
 * (sub-organizations). Mirrors the host implementation but is driven entirely
 * by props, so any consumer can drop it next to `<Billing />` with the same
 * `userdata` / `selectedOrganization` / `globalUrl` / `handleGetOrg` set.
 */
import { ChevronDown as ExpandMoreIcon, Plus as AddIcon, ArrowLeftRight as SwapIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
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
  Avatar,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import { toast } from '../toast';
import { getApiUrl, getAuthHeader } from '../api';

interface OrgLike {
  id: string;
  name?: string;
  image?: string;
  creator_org?: string;
  region_url?: string;
}

export interface TenantManagementProps {
  /** Userdata from /api/v1/getinfo. Used for `orgs` list + active_org fallback. */
  userdata?: any;
  /** Current selected organization (full org). */
  selectedOrganization?: OrgLike;
  /** Override base URL (otherwise uses shared getApiUrl). */
  globalUrl?: string;
  /** Switch active org. Should perform the org swap + reload upstream. */
  setActiveOrg?: (orgId: string) => Promise<void> | void;
  /** Optional callback after mutations (refresh getinfo). */
  handleGetOrg?: () => void;
  serverside?: boolean;
  isLoaded?: boolean;
}

// Lightweight region flag helper. Mirrors src/lib/regionFlag so this surface
// stays self-contained inside Shuffle-Core.
const getRegionFlag = (regionUrl?: string): { flag: string; code: string } => {
  if (!regionUrl) return { flag: '🇬🇧', code: 'UK' };
  const u = regionUrl.toLowerCase();
  if (u.includes('us.shuffler')) return { flag: '🇺🇸', code: 'US' };
  if (u.includes('frankfurt')) return { flag: '🇩🇪', code: 'DE' };
  if (u.includes('eu.shuffler')) return { flag: '🇪🇺', code: 'EU' };
  if (u.includes('ca.shuffler')) return { flag: '🇨🇦', code: 'CA' };
  if (u.includes('au.shuffler')) return { flag: '🇦🇺', code: 'AUS' };
  return { flag: '🇬🇧', code: 'UK' };
};

const TenantManagement: React.FC<TenantManagementProps> = (props) => {
  const { userdata, selectedOrganization, setActiveOrg, handleGetOrg } = props;
  const currentOrgId = selectedOrganization?.id || userdata?.active_org?.id;
  const activeOrg = selectedOrganization || userdata?.active_org;
  const allOrgs: OrgLike[] = userdata?.orgs || [];

  const [subOrgs, setSubOrgs] = useState<OrgLike[]>([]);
  const [parentOrg, setParentOrg] = useState<OrgLike | null>(null);
  const [subOrgsLoading, setSubOrgsLoading] = useState(false);

  const [showSubOrgs, setShowSubOrgs] = useState(false);
  const [showAllOrgs, setShowAllOrgs] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  const fetchSubOrgs = useCallback(async () => {
    if (!currentOrgId) return;
    setSubOrgsLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/v1/orgs/${currentOrgId}/suborgs`), {
        method: 'GET',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setSubOrgs([]);
        setParentOrg(null);
        return;
      }
      const data = await response.json();
      const orgs = Array.isArray(data) ? data : (data.child_orgs || data.orgs || data.subOrgs || []);
      const trueChildren = orgs.filter((org: any) => {
        if (!org?.id || org.id === currentOrgId) return false;
        if (org.creator_org) return org.creator_org === currentOrgId;
        return true;
      });
      setSubOrgs(trueChildren.map((org: any) => ({
        id: org.id,
        name: org.name || org.id,
        image: org.image,
        creator_org: org.creator_org,
        region_url: org.region_url || undefined,
      })));
      const parent = data.parentOrg || data.parent_org;
      setParentOrg(parent && parent.id ? {
        id: parent.id,
        name: parent.name || parent.id,
        image: parent.image,
        creator_org: parent.creator_org,
        region_url: parent.region_url || undefined,
      } : null);
    } catch {
      setSubOrgs([]);
      setParentOrg(null);
    } finally {
      setSubOrgsLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => { fetchSubOrgs(); }, [fetchSubOrgs]);

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === currentOrgId || !setActiveOrg) return;
    setSwitchingOrgId(orgId);
    try {
      await setActiveOrg(orgId);
    } catch {
      setSwitchingOrgId(null);
    }
  };

  const handleCreateSubOrg = async () => {
    if (!newOrgName.trim() || !currentOrgId) return;
    setCreating(true);
    try {
      const response = await fetch(getApiUrl(`/api/v1/orgs/${currentOrgId}/create_sub_org`), {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: currentOrgId, name: newOrgName.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.reason || 'Failed to create sub-organization');
      }
      toast.success(`Sub-organization "${newOrgName.trim()}" created successfully`);
      setCreateDialogOpen(false);
      setNewOrgName('');
      fetchSubOrgs();
      handleGetOrg?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create sub-organization');
    } finally {
      setCreating(false);
    }
  };

  const OrgRow = ({ org, showSwitch = true }: { org: OrgLike; showSwitch?: boolean }) => {
    const isCurrent = org.id === currentOrgId;
    const region = getRegionFlag(org.region_url);
    return (
      <TableRow hover sx={{ opacity: switchingOrgId === org.id ? 0.5 : 1 }}>
        <TableCell>
          <Avatar
            src={org.image && org.image.startsWith('data:') ? org.image : undefined}
            sx={{ bgcolor: 'hsl(var(--primary))', width: 36, height: 36, fontSize: '0.875rem' }}
          >
            {(org.name || org.id)?.charAt(0).toUpperCase() || '?'}
          </Avatar>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>
              {org.name || org.id}
            </Typography>
            {isCurrent && (
              <Chip label="Current" size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }} />
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{region.flag}</span>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
              {region.code}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {org.id}
          </Typography>
        </TableCell>
        <TableCell>
          {showSwitch && !isCurrent && setActiveOrg && (
            <Button
              size="small"
              variant="outlined"
              startIcon={switchingOrgId === org.id ? <CircularProgress size={14} /> : <SwapIcon />}
              disabled={!!switchingOrgId}
              onClick={() => handleSwitchOrg(org.id)}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                '&:hover': { borderColor: 'hsl(var(--primary))', bgcolor: 'hsl(var(--primary) / 0.1)' },
              }}
            >
              Switch
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Tenants
          </Typography>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.5 }}>
            Create, manage and switch between sub-organizations (tenants).
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            textTransform: 'none',
            bgcolor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
          }}
        >
          Add sub-tenant
        </Button>
      </Box>

      <Paper sx={{ bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', mb: 3 }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid hsl(var(--border))' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Current Tenant
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60, color: 'hsl(var(--muted-foreground))' }}>Logo</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Name</TableCell>
                <TableCell sx={{ width: 80, color: 'hsl(var(--muted-foreground))' }}>Region</TableCell>
                <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>ID</TableCell>
                <TableCell sx={{ width: 120, color: 'hsl(var(--muted-foreground))' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeOrg ? (
                <OrgRow org={activeOrg} showSwitch={false} />
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>No active tenant</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {parentOrg && parentOrg.id !== currentOrgId && (
        <Paper sx={{ bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', mb: 3 }}>
          <Box sx={{ p: 2.5, borderBottom: '1px solid hsl(var(--border))' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Parent Tenant
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60, color: 'hsl(var(--muted-foreground))' }}>Logo</TableCell>
                  <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Name</TableCell>
                  <TableCell sx={{ width: 80, color: 'hsl(var(--muted-foreground))' }}>Region</TableCell>
                  <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>ID</TableCell>
                  <TableCell sx={{ width: 120, color: 'hsl(var(--muted-foreground))' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <OrgRow org={parentOrg} />
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper sx={{ bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', mb: 3 }}>
        <Box
          onClick={() => setShowSubOrgs(!showSubOrgs)}
          sx={{
            p: 2.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'hsl(var(--muted) / 0.5)' },
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Sub Tenants{subOrgs.length > 0 ? ` (${subOrgs.length})` : ''}
          </Typography>
          <ExpandMoreIcon style={{ color: 'hsl(var(--muted-foreground))', transform: showSubOrgs ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </Box>
        <Collapse in={showSubOrgs}>
          {subOrgsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : subOrgs.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                No sub-tenants found
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 60, color: 'hsl(var(--muted-foreground))' }}>Logo</TableCell>
                    <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Name</TableCell>
                    <TableCell sx={{ width: 80, color: 'hsl(var(--muted-foreground))' }}>Region</TableCell>
                    <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>ID</TableCell>
                    <TableCell sx={{ width: 120, color: 'hsl(var(--muted-foreground))' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subOrgs.map((org) => (
                    <OrgRow key={org.id} org={org} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Paper>

      <Paper sx={{ bgcolor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <Box
          onClick={() => setShowAllOrgs(!showAllOrgs)}
          sx={{
            p: 2.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'hsl(var(--muted) / 0.5)' },
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            All Tenants{allOrgs.length > 0 ? ` (${allOrgs.length})` : ''}
          </Typography>
          <ExpandMoreIcon style={{ color: 'hsl(var(--muted-foreground))', transform: showAllOrgs ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </Box>
        <Collapse in={showAllOrgs}>
          {allOrgs.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                No tenants available
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 60, color: 'hsl(var(--muted-foreground))' }}>Logo</TableCell>
                    <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>Name</TableCell>
                    <TableCell sx={{ width: 80, color: 'hsl(var(--muted-foreground))' }}>Region</TableCell>
                    <TableCell sx={{ color: 'hsl(var(--muted-foreground))' }}>ID</TableCell>
                    <TableCell sx={{ width: 120, color: 'hsl(var(--muted-foreground))' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allOrgs.map((org) => (
                    <OrgRow key={org.id} org={org} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Paper>

      <Dialog
        open={createDialogOpen}
        onClose={() => !creating && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 2,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
          Create Sub-Tenant
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 2 }}>
            Create a new sub-tenant under your current tenant.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Tenant Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            disabled={creating}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSubOrg()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'hsl(var(--foreground))',
                '& fieldset': { borderColor: 'hsl(var(--border))' },
                '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
              },
              '& .MuiInputLabel-root': { color: 'hsl(var(--muted-foreground))' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={creating}
            sx={{ color: 'hsl(var(--muted-foreground))', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubOrg}
            disabled={creating || !newOrgName.trim()}
            variant="contained"
            sx={{
              textTransform: 'none',
              bgcolor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
            }}
          >
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TenantManagement;
