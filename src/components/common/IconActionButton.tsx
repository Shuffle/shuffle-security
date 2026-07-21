import { IconButton, Tooltip } from '@mui/material';
import { forwardRef, ReactNode, MouseEventHandler } from 'react';

export type IconActionButtonTone = 'default' | 'success';

export interface IconActionButtonProps {
  tooltip?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  tone?: IconActionButtonTone;
  active?: boolean;
  children: ReactNode;
  'data-tour'?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Shared 36x36 outlined icon button used across list/detail pages
 * (Refresh, Add, Rocket automation, etc.). Keeps border, hover, and
 * active-state highlight colors consistent everywhere.
 */
export const IconActionButton = forwardRef<HTMLButtonElement, IconActionButtonProps>(
  ({ tooltip, onClick, disabled, tone = 'default', active = false, children, className, ...rest }, ref) => {
    const isSuccess = tone === 'success' && active;
    const button = (
      <IconButton
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={className}
        {...rest}
        sx={{
          width: 36,
          height: 36,
          color: isSuccess ? 'success.main' : 'text.secondary',
          border: '1px solid',
          borderColor: isSuccess ? 'success.main' : 'divider',
          borderRadius: 1,
          backgroundColor: 'transparent',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: isSuccess ? 'success.main' : 'text.secondary',
          },
          '&.Mui-disabled': {
            opacity: 0.5,
          },
        }}
      >
        {children}
      </IconButton>
    );
    if (!tooltip) return button;
    return <Tooltip title={tooltip}>{<span>{button}</span>}</Tooltip>;
  },
);
IconActionButton.displayName = 'IconActionButton';
