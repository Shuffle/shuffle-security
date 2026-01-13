import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Box, TextField, TextFieldProps, Paper, Typography, Avatar } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useUsers, User } from '@/hooks/useUsers';

interface MentionInputProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

interface MentionSuggestion {
  id: string;
  username: string;
  isAI?: boolean;
}

/**
 * TextField with @mention autocomplete dropdown.
 * Shows user suggestions when typing @username.
 */
export const MentionInput = ({ value, onChange, onSubmit, ...props }: MentionInputProps) => {
  const { users } = useUsers();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // All available users including AI Agent
  const allUsers: MentionSuggestion[] = [
    { id: 'ai-agent', username: 'AI Agent', isAI: true },
    ...users.map((u: User) => ({ id: u.id, username: u.username })),
  ];

  // Handle text change and detect @mentions
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    
    // Find if we're in the middle of typing a mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      setMentionStartPos(mentionMatch.index!);
      
      // Filter suggestions
      const filtered = allUsers.filter(u => 
        u.username.toLowerCase().includes(query)
      );
      
      setSuggestions(filtered.slice(0, 6));
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setMentionStartPos(-1);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  // Insert selected mention
  const insertMention = (user: MentionSuggestion) => {
    if (mentionStartPos === -1) return;
    
    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(mentionStartPos + mentionQuery.length + 1);
    const mentionText = `@${user.username.replace(/\s+/g, '')} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);
    setShowSuggestions(false);
    
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = mentionStartPos + mentionText.length;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Box sx={{ position: 'relative', flex: 1 }}>
      <TextField
        {...props}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <Paper
          ref={dropdownRef}
          elevation={8}
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            mb: 0.5,
            zIndex: 1400,
            bgcolor: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 1.5,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ p: 1 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'text.secondary', 
                px: 1, 
                py: 0.5, 
                display: 'block',
                fontWeight: 500,
              }}
            >
              Mention someone
            </Typography>
            
            {suggestions.map((user, idx) => (
              <Box
                key={user.id}
                onClick={() => insertMention(user)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: idx === selectedIndex ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
                  '&:hover': {
                    bgcolor: idx === selectedIndex ? 'rgba(255, 102, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: user.isAI ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 102, 0, 0.2)',
                    color: user.isAI ? '#22c55e' : '#ff6600',
                  }}
                >
                  {user.isAI ? <SmartToyIcon sx={{ fontSize: 16 }} /> : <PersonIcon sx={{ fontSize: 16 }} />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: idx === selectedIndex ? 600 : 400,
                      color: idx === selectedIndex ? '#ff6600' : 'text.primary',
                    }}
                  >
                    {user.username}
                  </Typography>
                  {user.isAI && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Automated assistant
                    </Typography>
                  )}
                </Box>
                {idx === selectedIndex && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                    ↵ to select
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default MentionInput;
