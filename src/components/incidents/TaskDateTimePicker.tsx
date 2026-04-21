import { useState } from 'react';
import { Box, Typography, IconButton, TextField } from '@mui/material';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskDateTimePickerProps {
  value: string; // ISO datetime string or empty
  onChange: (value: string) => void;
}

/**
 * Date/time picker for tasks with calendar UI and time input (HH:MM:SS)
 */
export const TaskDateTimePicker = ({ value, onChange }: TaskDateTimePickerProps) => {
  const [open, setOpen] = useState(false);
  
  // Parse the current value
  let currentDate: Date | undefined;
  let currentTime = '09:00:00';
  
  if (value) {
    // Try parsing as full datetime first
    if (value.includes('T')) {
      const parsed = new Date(value);
      if (isValid(parsed)) {
        currentDate = parsed;
        currentTime = format(parsed, 'HH:mm:ss');
      }
    } else {
      // Just a date
      const parsed = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) {
        currentDate = parsed;
      }
    }
  }
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Combine with current time
      const [hours, minutes, seconds] = currentTime.split(':').map(Number);
      date.setHours(hours || 0, minutes || 0, seconds || 0);
      onChange(date.toISOString());
    } else {
      onChange('');
    }
  };
  
  const handleTimeChange = (time: string) => {
    if (currentDate) {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      const newDate = new Date(currentDate);
      newDate.setHours(hours || 0, minutes || 0, seconds || 0);
      onChange(newDate.toISOString());
    }
  };
  
  const displayValue = currentDate 
    ? format(currentDate, 'MMM d, HH:mm')
    : '';
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.08)',
              borderColor: 'rgba(255,255,255,0.2)',
            },
          }}
        >
          <CalendarIcon size={14} className="text-muted-foreground" />
          <Typography 
            variant="caption" 
            sx={{ 
              color: displayValue ? 'text.primary' : 'text.secondary',
              fontSize: '0.75rem',
              minWidth: 70,
            }}
          >
            {displayValue || 'Set date'}
          </Typography>
        </Box>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[9999]" align="start">
        <Box sx={{ p: 2, bgcolor: 'hsl(var(--popover))', borderRadius: 2 }}>
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={handleDateSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          
          {/* Time input with seconds */}
          <Box sx={{ 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            pt: 2, 
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}>
            <Clock size={16} className="text-muted-foreground" />
            <TextField
              type="time"
              size="small"
              value={currentTime.substring(0, 5)} // HH:MM for input
              onChange={(e) => handleTimeChange(`${e.target.value}:00`)}
              inputProps={{ step: 1 }}
              sx={{
                width: 100,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(0, 0, 0, 0.2)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                },
                '& input': { fontSize: '0.8rem', py: 0.5 },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>:</Typography>
            <TextField
              type="number"
              size="small"
              placeholder="SS"
              value={currentTime.split(':')[2] || '00'}
              onChange={(e) => {
                const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                const [h, m] = currentTime.split(':');
                handleTimeChange(`${h}:${m}:${String(secs).padStart(2, '0')}`);
              }}
              inputProps={{ min: 0, max: 59 }}
              sx={{
                width: 50,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(0, 0, 0, 0.2)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#FF6600' },
                },
                '& input': { fontSize: '0.8rem', py: 0.5, textAlign: 'center' },
              }}
            />
          </Box>
          
          {/* Quick actions */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 2 }}>
            {[
              { label: 'Today', offset: 0 },
              { label: 'Tomorrow', offset: 1 },
              { label: '+1 Week', offset: 7 },
            ].map((opt) => (
              <Box
                key={opt.label}
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + opt.offset);
                  const [h, m, s] = currentTime.split(':').map(Number);
                  date.setHours(h || 9, m || 0, s || 0);
                  onChange(date.toISOString());
                }}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  fontSize: '0.7rem',
                  borderRadius: 1,
                  bgcolor: '#ff6600',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: '#e55c00' },
                }}
              >
                {opt.label}
              </Box>
            ))}
          </Box>
        </Box>
      </PopoverContent>
    </Popover>
  );
};

export default TaskDateTimePicker;
