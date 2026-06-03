import { Save as SaveIcon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { toast } from '@/lib/toast';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { getRegionFlag } from '@/lib/regionFlag';
import UsersPage from './UsersPage';
import { Billing, TenantManagement } from '@/Shuffle-Core';
import { SegmentedControl, type SegmentedItem } from '@/components/ui/segmented-control';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useTheme as useNextTheme } from 'next-themes';

const REGION_OPTIONS = [
  { value: '', label: 'Default (UK)' },
  { value: 'https://uk.shuffler.io', label: 'UK' },
  { value: 'https://us.shuffler.io', label: 'US' },
  { value: 'https://frankfurt.shuffler.io', label: 'DE' },
  { value: 'https://eu.shuffler.io', label: 'EU' },
  { value: 'https://ca.shuffler.io', label: 'CA' },
  { value: 'https://au.shuffler.io', label: 'AUS' },
];

interface OrgDetails {
  id: string;
  name: string;
  description: string;
  image: string;
  region_url: string;
}

const AdminPage = () => {

  usePageMeta({
    title: 'Admin',
    description: 'Admin panel for managing users, tenants, and organization-wide settings.',
    url: '/admin',
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { userInfo, refreshUserInfo, setActiveOrg } = useAuth();
  const { resolvedTheme } = useNextTheme();
  const shuffleTheme = (resolvedTheme === 'light' ? 'light' : 'dark') as 'light' | 'dark';
  const orgId = userInfo?.active_org?.id;

  // Determine active tab from path
  const getTabFromPath = useCallback(() => {
    if (location.pathname === '/admin/users') return 1;
    if (location.pathname === '/admin/tenants') return 2;
    if (location.pathname === '/admin/billing') return 3;
    return 0;
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState(getTabFromPath());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fullOrg, setFullOrg] = useState<any>(null);

  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgImage, setOrgImage] = useState('');
  const [orgRegionUrl, setOrgRegionUrl] = useState('');

  // Track original values to detect changes
  const [originalName, setOriginalName] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalImage, setOriginalImage] = useState('');
  const [originalRegionUrl, setOriginalRegionUrl] = useState('');

  // Sync tab with route
  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [getTabFromPath]);

  const handleTabChange = (_: unknown, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 0) navigate('/admin');
    else if (newValue === 1) navigate('/admin/users');
    else if (newValue === 2) navigate('/admin/tenants');
    else if (newValue === 3) navigate('/admin/billing');
  };

  // Fetch org details
  useEffect(() => {
    if (!orgId) return;

    const fetchOrg = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}`), {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });

        if (!response.ok) throw new Error('Failed to fetch organization details');

        const data = await response.json();
        setFullOrg(data);
        const name = data.name || '';
        const description = data.description || '';
        const image = data.image || '';
        const regionUrl = data.region_url || '';
        
        setOrgName(name);
        setOrgDescription(description);
        setOrgImage(image);
        setOrgRegionUrl(regionUrl);
        
        setOriginalName(name);
        setOriginalDescription(description);
        setOriginalImage(image);
        setOriginalRegionUrl(regionUrl);
      } catch (err) {
        // Fallback to userInfo
        const name = userInfo?.active_org?.name || '';
        const image = userInfo?.active_org?.image || '';
        const regionUrl = userInfo?.active_org?.region_url || '';
        
        setOrgName(name);
        setOrgDescription('');
        setOrgImage(image);
        setOrgRegionUrl(regionUrl);
        
        setOriginalName(name);
        setOriginalDescription('');
        setOriginalImage(image);
        setOriginalRegionUrl(regionUrl);
        
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [orgId, userInfo]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);

    try {
      // Build payload with only changed fields + org_id
      const payload: Record<string, string> = { org_id: orgId };
      
      if (orgName !== originalName) payload.name = orgName;
      if (orgDescription !== originalDescription) payload.description = orgDescription;
      if (orgImage !== originalImage) payload.image = orgImage;
      if (orgRegionUrl !== originalRegionUrl) payload.region_url = orgRegionUrl;

      const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.reason || 'Failed to update organization');
      }

      // Update original values to current values
      setOriginalName(orgName);
      setOriginalDescription(orgDescription);
      setOriginalImage(orgImage);
      setOriginalRegionUrl(orgRegionUrl);

      toast.success('Tenant updated successfully');
      await refreshUserInfo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setOrgImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setOrgImage('');
  };

  const regionFlag = getRegionFlag(orgRegionUrl);

  return (
    <Box sx={{ p: { xs: 0, sm: 0 }, maxWidth: 1200, width: '100%', mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: 'hsl(var(--foreground))' }}>
        Tenant Admin
      </Typography>
      <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 3 }}>
        Manage your tenant settings, users, and sub-tenants.
      </Typography>

      {(() => {
        const isSupport = userInfo?.support === true;
        type TabValue = 'overview' | 'users' | 'tenants' | 'billing';
        const valueByIndex: TabValue[] = ['overview', 'users', 'tenants', 'billing'];
        const currentValue: TabValue = valueByIndex[activeTab] ?? 'overview';
        const options: SegmentedItem<TabValue>[] = [
          { value: 'overview', label: 'Overview' },
          { value: 'users', label: 'Users' },
          { value: 'tenants', label: 'Tenants' },
          {
            value: 'billing',
            label: 'Billing',
            disabled: !isSupport,
            title: isSupport ? undefined : 'Only support users can view billing',
          },
        ];
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <SegmentedControl<TabValue>
              options={options}
              value={currentValue}
              onChange={(v) => handleTabChange(null, valueByIndex.indexOf(v))}
              variant="filled"
              ariaLabel="Admin sections"
            />
          </Box>
        );
      })()}

      {activeTab === 0 && (
        <>
          {error && (
            <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: 'hsl(var(--primary))' }} />
            </Box>
          ) : (
            <Box sx={{ maxWidth: 700 }}>
              {/* Image section */}
              <Paper
                sx={{
                  p: 3,
                  mb: 3,
                  bgcolor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                  <Avatar
                    src={orgImage && orgImage.startsWith('data:') ? orgImage : undefined}
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      fontSize: '2rem',
                      fontWeight: 600,
                      borderRadius: 3,
                    }}
                    variant="rounded"
                  >
                    {orgName?.charAt(0)?.toUpperCase() || '?'}
                  </Avatar>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{
                        borderColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary))',
                        '&:hover': { bgcolor: 'hsla(var(--primary) / 0.1)' },
                      }}
                    >
                      Update
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </Button>
                    {orgImage && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleRemoveImage}
                        sx={{
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--muted-foreground))',
                          '&:hover': { bgcolor: 'hsl(var(--muted))' },
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>

              {/* Name, Status, Region row */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  label="Name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'hsl(var(--foreground))',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
                      '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
                    },
                    '& .MuiInputLabel-root': { color: 'hsl(var(--muted-foreground))' },
                  }}
                />

                <FormControl sx={{ minWidth: 160 }}>
                  <InputLabel sx={{ color: 'hsl(var(--muted-foreground))' }}>Region</InputLabel>
                  <Select
                    value={orgRegionUrl}
                    label="Region"
                    onChange={(e) => setOrgRegionUrl(e.target.value)}
                    sx={{
                      color: 'hsl(var(--foreground))',
                      '& fieldset': { borderColor: 'hsl(var(--border))' },
                      '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
                    }}
                    renderValue={() => {
                      const r = getRegionFlag(orgRegionUrl);
                      return `${r.flag} ${r.code}`;
                    }}
                  >
                    {REGION_OPTIONS.map((opt) => {
                      const r = getRegionFlag(opt.value);
                      return (
                        <MenuItem key={opt.value} value={opt.value}>
                          {r.flag} {opt.label}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>

              {/* Description */}
              <TextField
                label="Description"
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                multiline
                rows={4}
                fullWidth
                placeholder="Tenant description"
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    color: 'hsl(var(--foreground))',
                    '& fieldset': { borderColor: 'hsl(var(--border))' },
                    '&:hover fieldset': { borderColor: 'hsl(var(--primary))' },
                  },
                  '& .MuiInputLabel-root': { color: 'hsl(var(--muted-foreground))' },
                }}
              />

              {/* Save button */}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                sx={{
                  bgcolor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  height: 36,
                  '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          )}
        </>
      )}

      {activeTab === 1 && <UsersPage embedded />}
      {activeTab === 2 && (
        <TenantManagement
          theme={shuffleTheme}
          {...({
            userdata: userInfo,
            selectedOrganization: fullOrg || userInfo?.active_org,
            globalUrl: getApiUrl(''),
            serverside: false,
            isLoaded: true,
            setActiveOrg,
            handleGetOrg: refreshUserInfo,
          } as any)}
        />
      )}
      {activeTab === 3 && userInfo?.support !== true && (
        <Alert severity="info">Only support users can view billing.</Alert>
      )}
      {activeTab === 3 && userInfo?.support === true && (() => {
        const origin = typeof window === 'undefined' || window.location === undefined ? '' : window.location.origin;
        const isLiveStripeOrigin = origin === 'https://shuffler.io' || origin === 'https://security.shuffler.io';
        const stripeKey = isLiveStripeOrigin
          ? 'pk_live_51PXYYMEJjT17t98N20qEqItyt1fLQjrnn41lPeG2PjnSlZHTDNKHuisAbW00s4KAn86nGuqB9uSVU4ds8MutbnMU00DPXpZ8ZD'
          : 'pk_test_51PXYYMEJjT17t98NbDkojZ3DRvsFUQBs35LGMx3i436BXwEBVFKB9nCvHt0Q3M4MG3dz4mHheuWvfoYvpaL3GmsG00k1Rb2ksO';
        const isSupport = userInfo?.support === true;
        const searchParams = new URLSearchParams(location.search);
        const viewParam = searchParams.get('view');
        const billingView: 'cloud' | 'onprem' = isSupport && viewParam === 'onprem' ? 'onprem' : 'cloud';
        const setBillingView = (next: 'cloud' | 'onprem') => {
          const sp = new URLSearchParams(location.search);
          sp.set('view', next);
          navigate(`${location.pathname}?${sp.toString()}`, { replace: true });
        };
        return (
          <>
            {isSupport && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <SegmentedControl<'cloud' | 'onprem'>
                  options={[
                    { value: 'cloud', label: 'Cloud' },
                    { value: 'onprem', label: 'On-prem' },
                  ]}
                  value={billingView}
                  onChange={(v) => setBillingView(v)}
                  variant="filled"
                  ariaLabel="Billing view"
                />
              </Box>
            )}
            <Billing
              theme={shuffleTheme}
              {...({
                userdata: userInfo,
                selectedOrganization: fullOrg || userInfo?.active_org,
                globalUrl: getApiUrl(''),
                serverside: false,
                isLoaded: true,
                billingInfo: {},
                stripeKey,
                isCloud: billingView === 'cloud',
                handleGetOrg: refreshUserInfo,
              } as any)}
            />
          </>
        );
      })()}
    </Box>
  );
};

export default AdminPage;
