/**
 * useIsSupport — true when the current user is a Shuffle support user.
 *
 * Backed by /api/v1/getinfo => support === true. Use to expose deeper
 * diagnostic information (workflow IDs, raw failure reasons, internal
 * config keys) that regular users should not see.
 */
import { useAuth } from '@/context/AuthContext';

export const useIsSupport = (): boolean => {
  const { userInfo } = useAuth();
  return (userInfo as { support?: boolean } | null)?.support === true;
};
