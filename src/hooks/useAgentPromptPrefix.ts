/**
 * useAgentPromptPrefix — per-user default prompt prefix shown as a chip at the
 * start of the AgentUI input. The chip is a visual affordance ("you are typing
 * to Shuffle Tools MCP") and its underlying prompt text is prepended to the
 * user's message on submit.
 *
 * Storage: Shuffle datastore, category `agent-prompt-prefix`.
 * Key:     current user id (from useAuth). Falls back to `default` when the
 *          user id is not yet available.
 * Value:   { prompt: string } — plain JSON.
 *
 * The datastore itself is org-scoped, so the prefix is effectively
 * per-user-per-org without extra wiring.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatastoreItem, setDatastoreItem } from '@/Shuffle-MCPs/datastore';
import { useAuth } from '@/context/AuthContext';

export const AGENT_PROMPT_PREFIX_CATEGORY = 'agent-prompt-prefix';

/** Default seed used until the user saves their own prefix. */
export const DEFAULT_AGENT_PROMPT_PREFIX =
  'You are the Shuffle Tools agent. Use the connected Shuffle tools to help me with the request that follows.';

const decodePrompt = (raw: unknown): string | null => {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.prompt === 'string') {
        return parsed.prompt;
      }
    } catch { /* fall through */ }
    // Legacy: raw string stored directly.
    return raw;
  }
  if (typeof raw === 'object') {
    const obj = raw as { prompt?: unknown; value?: unknown };
    if (typeof obj.prompt === 'string') return obj.prompt;
    if (typeof obj.value === 'string') {
      try {
        const parsed = JSON.parse(obj.value);
        if (parsed && typeof parsed.prompt === 'string') return parsed.prompt;
      } catch { /* ignore */ }
      return obj.value;
    }
  }
  return null;
};

export const useAgentPromptPrefix = () => {
  const { userInfo } = useAuth();
  const userId = userInfo?.id || 'default';
  const [prompt, setPrompt] = useState<string>(DEFAULT_AGENT_PROMPT_PREFIX);
  const [hasFetched, setHasFetched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fetchedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedForUser.current === userId) return;
    fetchedForUser.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const res = await getDatastoreItem(userId, AGENT_PROMPT_PREFIX_CATEGORY);
        if (cancelled) return;
        if (res.success && res.item) {
          const parsed = decodePrompt(res.item.value ?? res.item);
          if (parsed && parsed.trim().length > 0) {
            setPrompt(parsed);
          }
        }
      } catch {
        // Non-fatal — keep default.
      } finally {
        if (!cancelled) setHasFetched(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const savePrompt = useCallback(async (next: string): Promise<boolean> => {
    setIsSaving(true);
    const prev = prompt;
    setPrompt(next); // optimistic
    try {
      const res = await setDatastoreItem(userId, { prompt: next }, AGENT_PROMPT_PREFIX_CATEGORY);
      if (!res.success) {
        setPrompt(prev);
        return false;
      }
      return true;
    } catch {
      setPrompt(prev);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [prompt, userId]);

  return { prompt, savePrompt, hasFetched, isSaving };
};
