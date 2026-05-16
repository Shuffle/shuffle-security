/**
 * Schedule Import Dialog
 * Allows importing schedules from common formats (CSV, iCal)
 */

import { Upload as UploadIcon, AlertTriangle as WarningIcon, CheckCircle2 as CheckIcon } from 'lucide-react';
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
} from '@mui/material';
type EscalationLevel = 'tier1' | 'tier2' | 'tier3' | 'manager';

interface ScheduleEntry {
  id: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  daysOfWeek: number[];
}

interface UserSchedule {
  userId: string;
  userName: string;
  userEmail: string;
  escalationLevel: EscalationLevel;
  schedules: ScheduleEntry[];
  enabled: boolean;
}

interface ExistingUser {
  id: string;
  username: string;
}

interface ParsedScheduleEntry {
  userName: string;
  userEmail?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  matchedUserId?: string;
  escalationLevel: EscalationLevel;
  status: 'matched' | 'unmatched' | 'create';
}

interface ScheduleImportDialogProps {
  open: boolean;
  onClose: () => void;
  existingUsers: ExistingUser[];
  onImport: (schedules: UserSchedule[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 12);

// Parse CSV content
const parseCSV = (content: string): ParsedScheduleEntry[] => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const entries: ParsedScheduleEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    // Try to parse days - common formats: "Mon,Tue,Wed" or "1,2,3" or "Monday-Friday"
    let daysOfWeek: number[] = [1, 2, 3, 4, 5]; // Default weekdays
    const daysStr = row['days'] || row['days_of_week'] || row['weekdays'] || '';
    if (daysStr) {
      if (daysStr.toLowerCase().includes('monday-friday') || daysStr.toLowerCase().includes('weekdays')) {
        daysOfWeek = [1, 2, 3, 4, 5];
      } else if (daysStr.includes(',')) {
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        daysOfWeek = daysStr.split(',').map(d => {
          const trimmed = d.trim().toLowerCase().substring(0, 3);
          const idx = dayNames.indexOf(trimmed);
          return idx >= 0 ? idx : parseInt(d.trim(), 10);
        }).filter(d => !isNaN(d) && d >= 0 && d <= 6);
      }
    }
    
    entries.push({
      userName: row['name'] || row['user'] || row['username'] || row['assignee'] || '',
      userEmail: row['email'] || row['user_email'] || '',
      startDate: row['start_date'] || row['startdate'] || row['from'] || new Date().toISOString().split('T')[0],
      endDate: row['end_date'] || row['enddate'] || row['to'] || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime: row['start_time'] || row['starttime'] || row['start'] || '09:00',
      endTime: row['end_time'] || row['endtime'] || row['end'] || '17:00',
      daysOfWeek,
      escalationLevel: (row['level'] || row['tier'] || row['escalation'] || 'tier1') as EscalationLevel,
      status: 'unmatched',
    });
  }
  
  return entries.filter(e => e.userName);
};

// Parse iCal content (simplified)
const parseICS = (content: string): ParsedScheduleEntry[] => {
  const entries: ParsedScheduleEntry[] = [];
  const events = content.split('BEGIN:VEVENT');
  
  for (const event of events.slice(1)) {
    const lines = event.split('\n');
    let summary = '';
    let dtstart = '';
    let dtend = '';
    let rrule = '';
    
    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) summary = line.replace('SUMMARY:', '').trim();
      if (line.startsWith('DTSTART')) dtstart = line.split(':').pop()?.trim() || '';
      if (line.startsWith('DTEND')) dtend = line.split(':').pop()?.trim() || '';
      if (line.startsWith('RRULE:')) rrule = line.replace('RRULE:', '').trim();
    }
    
    if (!summary || !dtstart) continue;
    
    // Parse dates
    const startDate = dtstart.length >= 8 
      ? `${dtstart.substring(0, 4)}-${dtstart.substring(4, 6)}-${dtstart.substring(6, 8)}`
      : new Date().toISOString().split('T')[0];
    
    const endDate = dtend && dtend.length >= 8
      ? `${dtend.substring(0, 4)}-${dtend.substring(4, 6)}-${dtend.substring(6, 8)}`
      : startDate;
    
    // Parse time
    const startTime = dtstart.includes('T') && dtstart.length >= 15
      ? `${dtstart.substring(9, 11)}:${dtstart.substring(11, 13)}`
      : '09:00';
    
    const endTime = dtend && dtend.includes('T') && dtend.length >= 15
      ? `${dtend.substring(9, 11)}:${dtend.substring(11, 13)}`
      : '17:00';
    
    // Parse recurrence rule for days
    let daysOfWeek: number[] = [1, 2, 3, 4, 5];
    if (rrule.includes('BYDAY=')) {
      const byDay = rrule.match(/BYDAY=([^;]+)/)?.[1] || '';
      const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
      daysOfWeek = byDay.split(',').map(d => dayMap[d.replace(/[0-9-]/g, '')]).filter(d => d !== undefined);
    }
    
    entries.push({
      userName: summary.replace(/on[- ]?call:?\s*/i, '').trim(),
      startDate,
      endDate: rrule.includes('UNTIL=') 
        ? (() => {
            const until = rrule.match(/UNTIL=(\d{8})/)?.[1];
            return until ? `${until.substring(0, 4)}-${until.substring(4, 6)}-${until.substring(6, 8)}` : endDate;
          })()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime,
      endTime,
      daysOfWeek,
      escalationLevel: 'tier1',
      status: 'unmatched',
    });
  }
  
  return entries;
};

export const ScheduleImportDialog = ({ 
  open, 
  onClose, 
  existingUsers, 
  onImport 
}: ScheduleImportDialogProps) => {
  const [parsedEntries, setParsedEntries] = useState<ParsedScheduleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setError(null);
    
    try {
      const content = await file.text();
      let entries: ParsedScheduleEntry[] = [];
      
      if (file.name.endsWith('.csv')) {
        entries = parseCSV(content);
      } else if (file.name.endsWith('.ics') || file.name.endsWith('.ical')) {
        entries = parseICS(content);
      } else {
        setError('Unsupported file format. Please use CSV or iCal (.ics) files.');
        return;
      }
      
      if (entries.length === 0) {
        setError('No valid schedule entries found in the file.');
        return;
      }
      
      // Try to match users
      const matchedEntries = entries.map(entry => {
        const matchedUser = existingUsers.find(u => 
          u.username.toLowerCase() === entry.userName.toLowerCase() ||
          u.username.toLowerCase() === entry.userEmail?.toLowerCase()
        );
        
        return {
          ...entry,
          matchedUserId: matchedUser?.id,
          status: matchedUser ? 'matched' : 'unmatched',
        } as ParsedScheduleEntry;
      });
      
      setParsedEntries(matchedEntries);
    } catch (err) {
      setError('Failed to parse file. Please check the format.');
    }
  };

  const handleUserMatch = (entryIndex: number, userId: string) => {
    setParsedEntries(prev => prev.map((entry, idx) => {
      if (idx !== entryIndex) return entry;
      const user = existingUsers.find(u => u.id === userId);
      return {
        ...entry,
        matchedUserId: userId,
        userName: user?.username || entry.userName,
        status: userId ? 'matched' : 'unmatched',
      };
    }));
  };

  const handleImport = () => {
    setImporting(true);
    
    // Group entries by user
    const userScheduleMap = new Map<string, UserSchedule>();
    
    for (const entry of parsedEntries) {
      if (entry.status !== 'matched' || !entry.matchedUserId) continue;
      
      const existingSchedule = userScheduleMap.get(entry.matchedUserId);
      const scheduleEntry: ScheduleEntry = {
        id: generateId(),
        startDate: entry.startDate,
        endDate: entry.endDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        daysOfWeek: entry.daysOfWeek,
      };
      
      if (existingSchedule) {
        existingSchedule.schedules.push(scheduleEntry);
      } else {
        userScheduleMap.set(entry.matchedUserId, {
          userId: entry.matchedUserId,
          userName: entry.userName,
          userEmail: entry.userEmail || entry.userName,
          escalationLevel: entry.escalationLevel,
          schedules: [scheduleEntry],
          enabled: true,
        });
      }
    }
    
    onImport(Array.from(userScheduleMap.values()));
    setImporting(false);
    handleClose();
  };

  const handleClose = () => {
    setParsedEntries([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const matchedCount = parsedEntries.filter(e => e.status === 'matched').length;
  const unmatchedCount = parsedEntries.filter(e => e.status === 'unmatched').length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import Schedule</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 2, color: 'hsl(var(--muted-foreground))' }}>
            Import on-call schedules from CSV or iCal files. The importer will attempt to match 
            schedule entries to existing users.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>CSV Format:</strong> Columns should include: name, start_date, end_date, start_time, end_time, days
              <br />
              <strong>iCal Format:</strong> Standard .ics files with VEVENT entries. The SUMMARY field should contain the assignee name.
            </Typography>
          </Alert>
          
          <input
            type="file"
            accept=".csv,.ics,.ical"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Schedule File
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {parsedEntries.length > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                icon={<CheckIcon />} 
                label={`${matchedCount} matched`} 
                color="success" 
                size="small" 
              />
              {unmatchedCount > 0 && (
                <Chip 
                  icon={<WarningIcon />} 
                  label={`${unmatchedCount} unmatched`} 
                  color="warning" 
                  size="small" 
                />
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Match User</TableCell>
                    <TableCell>Date Range</TableCell>
                    <TableCell>Hours</TableCell>
                    <TableCell>Days</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedEntries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{entry.userName}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={entry.matchedUserId || ''}
                            onChange={(e) => handleUserMatch(idx, e.target.value)}
                            displayEmpty
                          >
                            <MenuItem value="">
                              <em>-- Select User --</em>
                            </MenuItem>
                            {existingUsers.map(user => (
                              <MenuItem key={user.id} value={user.id}>
                                {user.username}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.startDate} - {entry.endDate}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {entry.startTime} - {entry.endTime}
                      </TableCell>
                      <TableCell>
                        {entry.daysOfWeek.map(d => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join('')}
                      </TableCell>
                      <TableCell>
                        {entry.status === 'matched' ? (
                          <Chip label="Matched" color="success" size="small" />
                        ) : (
                          <Chip label="Unmatched" color="warning" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {unmatchedCount > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {unmatchedCount} entries couldn't be matched to existing users. 
                Please select users from the dropdown or these entries will be skipped.
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleImport} 
          variant="contained" 
          disabled={matchedCount === 0 || importing}
          startIcon={importing ? <CircularProgress size={16} /> : null}
        >
          Import {matchedCount} Schedule{matchedCount !== 1 ? 's' : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
