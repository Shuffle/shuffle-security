/**
 * useIsAdmin — single source of truth for whether the current user is an
 * admin in the active org. Reads /api/v1/getinfo => active_org.role.
 *
 * Use this to gate admin-only UI like setup banners, "enable automation"
 * CTAs, and schedule-health reminders. Non-admins should not see those —
 * they can't act on them anyway.
 */
import { useAuth } from '@/context/AuthContext';

export const useIsAdmin = (): boolean => {
  const { userInfo } = useAuth();
  return userInfo?.active_org?.role === 'admin';
};
