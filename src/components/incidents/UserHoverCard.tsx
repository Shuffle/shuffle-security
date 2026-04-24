/**
 * UserHoverCard — renders a username with a hover popover containing
 * profile details (role, status, schedule hint). Used in the activity
 * feed to give users a definitive way to verify who posted a comment.
 *
 * Identity rules:
 *  - AI Agent: matches `isAIAssignee(name)` OR `is_agent === true` AND
 *    the name does not collide with any real org user. We require BOTH
 *    signals so a normal user cannot impersonate the agent simply by
 *    setting `is_agent: true` from a forged payload.
 *  - Real user: name matches an entry in the org user list.
 *  - Unknown: neither — rendered as plain text without a hover card.
 */
import { Box, Typography, Avatar, Chip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import AgentIcon from '@/components/agent/AgentIcon';
import { isAIAssignee } from '@/lib/utils';
import { useUsers, type User } from '@/hooks/useUsers';

interface UserHoverCardProps {
  /** Username to display (e.g. "@AIAgent" or "frikky"). */
  username: string;
  /** Optional `is_agent` flag from the activity payload. */
  isAgent?: boolean;
  /** Optional override for the rendered text styling. */
  className?: string;
}

const findRealUser = (users: User[], name: string): User | undefined => {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  return users.find((u) => u.username.toLowerCase() === lower);
};

export const UserHoverCard = ({ username, isAgent, className }: UserHoverCardProps) => {
  const { users } = useUsers();
  const navigate = useNavigate();

  const realUser = findRealUser(users, username);
  // Trust AI Agent identity only when the name itself looks like the agent
  // OR `is_agent: true` is set AND the name does NOT match a real user.
  const looksLikeAgent = isAIAssignee(username);
  const verifiedAgent = looksLikeAgent || (isAgent === true && !realUser);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (verifiedAgent) {
      navigate('/agent');
    } else if (realUser) {
      navigate('/users');
    }
  };

  // Plain text for unknown users (no hover card, no click).
  if (!verifiedAgent && !realUser) {
    return (
      <Typography
        component="span"
        variant="caption"
        className={className}
        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
      >
        {username}
      </Typography>
    );
  }

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Box
          component="span"
          onClick={handleClick}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.4,
            cursor: 'pointer',
            borderRadius: 0.75,
            px: 0.4,
            mx: -0.4,
            transition: 'background-color 0.15s',
            '&:hover': {
              bgcolor: 'hsl(var(--muted) / 0.6)',
            },
          }}
        >
          {verifiedAgent && <AgentIcon size={12} />}
          <Typography
            component="span"
            variant="caption"
            className={className}
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              color: verifiedAgent ? 'hsl(var(--primary))' : 'text.primary',
            }}
          >
            {username}
          </Typography>
        </Box>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        sideOffset={6}
        className="w-64 border border-border bg-popover p-3 text-popover-foreground shadow-xl z-[9999]"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: verifiedAgent
                ? 'hsl(var(--primary) / 0.18)'
                : 'hsl(var(--muted))',
              color: verifiedAgent ? 'hsl(var(--primary))' : 'text.secondary',
            }}
          >
            {verifiedAgent ? <AgentIcon size={18} /> : <PersonIcon sx={{ fontSize: 18 }} />}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}
              noWrap
            >
              {username}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              {verifiedAgent ? 'AI Agent · automated responder' : (realUser?.role || 'Team member')}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {verifiedAgent ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Schedule
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  Always on · 24/7
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Level
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  Tier 1 triage
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Verified
                </Typography>
                <Chip
                  label={looksLikeAgent ? 'Name match' : 'is_agent flag'}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    bgcolor: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Status
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: realUser?.active ? 'hsl(142 71% 45%)' : 'text.secondary',
                  }}
                >
                  {realUser?.active ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Role
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  {realUser?.role || '—'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Schedule
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                  See on-call
                </Typography>
              </Box>
            </>
          )}
        </Box>

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1.25,
            pt: 1,
            borderTop: '1px solid hsl(var(--border-subtle))',
            color: 'hsl(var(--primary))',
            fontSize: '0.7rem',
            fontWeight: 500,
          }}
        >
          {verifiedAgent ? 'Click to open Agent activity →' : 'Click to open Org Admin →'}
        </Typography>
      </HoverCardContent>
    </HoverCard>
  );
};

export default UserHoverCard;
