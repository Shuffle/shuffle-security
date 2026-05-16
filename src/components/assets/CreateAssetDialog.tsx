import { ChevronDown as ExpandMoreIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Collapse,
  Slider,
  CircularProgress,
} from '@mui/material';
import {
  OCSFDeviceInventory,
  DEVICE_TYPES,
  RISK_LEVELS,
  generateAssetUid,
} from '@/config/ocsfAssetSchema';

interface CreateAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (asset: OCSFDeviceInventory) => Promise<void>;
  kind?: 'device' | 'user';
}

export const CreateAssetDialog = ({ open, onClose, onSubmit, kind = 'device' }: CreateAssetDialogProps) => {
  const isUser = kind === 'user';
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [mac, setMac] = useState('');
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(0);
  const [desc, setDesc] = useState('');
  const [domain, setDomain] = useState('');
  const [riskLevelId, setRiskLevelId] = useState(0);
  const [riskScore, setRiskScore] = useState<number>(0);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [uid, setUid] = useState('');
  const [model, setModel] = useState('');
  const [region, setRegion] = useState('');
  const [subnet, setSubnet] = useState('');
  const [interfaceName, setInterfaceName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!hostname.trim()) return;

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const assetUid = generateAssetUid();

    const asset: OCSFDeviceInventory = {
      hostname: hostname.trim(),
      type_id: typeId,
      type: DEVICE_TYPES.find(t => t.id === typeId)?.label || 'Unknown',
      ip: ip.trim() || undefined,
      mac: mac.trim() || undefined,
      name: name.trim() || undefined,
      uid: uid.trim() || assetUid,
      desc: desc.trim() || undefined,
      domain: domain.trim() || undefined,
      risk_level_id: riskLevelId,
      risk_level: RISK_LEVELS.find(r => r.id === riskLevelId)?.label || 'Info',
      risk_score: riskScore > 0 ? String(riskScore) : undefined,
      model: model.trim() || undefined,
      region: region.trim() || undefined,
      subnet: subnet.trim() || undefined,
      interface_name: interfaceName.trim() || undefined,
      owner: ownerName.trim() || ownerEmail.trim()
        ? { name: ownerName.trim() || undefined, email: ownerEmail.trim() || undefined }
        : undefined,
      created_time: now,
      first_seen_time: now,
      last_seen_time: now,
      metadata: {
        uid: assetUid,
        extensions: {
          custom_attributes: {
            comments: [],
          },
        },
      },
    };

    await onSubmit(asset);
    setIsSubmitting(false);
    handleClose();
  };

  const handleClose = () => {
    setHostname('');
    setIp('');
    setMac('');
    setName('');
    setTypeId(0);
    setDesc('');
    setDomain('');
    setRiskLevelId(0);
    setRiskScore(0);
    setOwnerName('');
    setOwnerEmail('');
    setUid('');
    setModel('');
    setRegion('');
    setSubnet('');
    setInterfaceName('');
    setShowAdvanced(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {isUser ? 'Add User' : 'Add Device'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {isUser
            ? 'Identity user — IAM, Okta, Entra, Workspace'
            : 'OCSF Device Inventory Info (class_uid: 6002)'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {/* Hostname / Username — required */}
          <TextField
            label={isUser ? 'Username' : 'Hostname'}
            value={hostname}
            onChange={e => setHostname(e.target.value)}
            fullWidth
            required
            placeholder={isUser ? 'e.g., jane.doe' : 'e.g., prod-web-01.corp.example.com'}
          />

          {/* IP + Device Type  /  Email + Role for users */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={isUser ? 'Email' : 'IP Address'}
              value={isUser ? ownerEmail : ip}
              onChange={e => (isUser ? setOwnerEmail(e.target.value) : setIp(e.target.value))}
              fullWidth
              placeholder={isUser ? 'e.g., jane@example.com' : 'e.g., 10.0.1.42'}
            />
            {!isUser && (
              <TextField
                select
                label="Device Type"
                value={typeId}
                onChange={e => setTypeId(Number(e.target.value))}
                fullWidth
              >
                {DEVICE_TYPES.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          {/* Risk Level */}
          <TextField
            select
            label="Risk Level"
            value={riskLevelId}
            onChange={e => setRiskLevelId(Number(e.target.value))}
            fullWidth
          >
            {RISK_LEVELS.map(r => (
              <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
            ))}
          </TextField>

          {/* Advanced toggle */}
          <Box
            onClick={() => setShowAdvanced(!showAdvanced)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              '&:hover': { color: 'hsl(var(--foreground))' },
            }}
          >
            <ExpandMoreIcon sx={{
              fontSize: 20,
              transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Advanced options
            </Typography>
          </Box>

          <Collapse in={showAdvanced}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Description */}
              <TextField
                label="Description"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Description of this device…"
              />

              {/* Name + MAC */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Name (alternate)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  fullWidth
                  placeholder="e.g., Jim's Laptop"
                />
                <TextField
                  label="MAC Address"
                  value={mac}
                  onChange={e => setMac(e.target.value)}
                  fullWidth
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                />
              </Box>

              {/* Domain + Model */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Domain"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  fullWidth
                  placeholder="e.g., work.example.com"
                />
                <TextField
                  label="Model"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  fullWidth
                  placeholder="e.g., ThinkPad X1 Carbon"
                />
              </Box>

              {/* Owner */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Owner Name"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  fullWidth
                  placeholder="e.g., Jane Doe"
                />
                <TextField
                  label="Owner Email"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  fullWidth
                  placeholder="e.g., jane@example.com"
                />
              </Box>

              {/* UID + Interface */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Unique ID"
                  value={uid}
                  onChange={e => setUid(e.target.value)}
                  fullWidth
                  placeholder="e.g., AWS ARN or SID"
                />
                <TextField
                  label="Interface"
                  value={interfaceName}
                  onChange={e => setInterfaceName(e.target.value)}
                  fullWidth
                  placeholder="e.g., eth0"
                />
              </Box>

              {/* Region + Subnet */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Region"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  fullWidth
                  placeholder="e.g., us-east-1"
                />
                <TextField
                  label="Subnet"
                  value={subnet}
                  onChange={e => setSubnet(e.target.value)}
                  fullWidth
                  placeholder="e.g., 255.255.255.0"
                />
              </Box>

              {/* Risk Score slider */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Risk Score: {riskScore}
                </Typography>
                <Slider
                  value={riskScore}
                  onChange={(_, v) => setRiskScore(v as number)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{ color: 'hsl(var(--primary))' }}
                />
              </Box>
            </Box>
          </Collapse>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!hostname.trim() || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
        >
          {isSubmitting ? 'Adding…' : (isUser ? 'Add User' : 'Add Device')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
