import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert HTML to readable plain text.
 * - Converts block elements (div, p, br) to newlines
 * - Decodes HTML entities (&nbsp;, &amp;, etc.)
 * - Strips remaining HTML tags
 * - Normalizes whitespace while preserving intentional line breaks
 */

// Pre-compiled regexes to avoid creating them on every call
const HTML_BLOCK_END_RE = /<\/(div|p|h[1-6]|li|tr)>/gi;
const HTML_BR_RE = /<br\s*\/?>/gi;
const HTML_LIST_RE = /<\/?(ul|ol|table|tbody|thead)>/gi;
const HTML_TAG_RE = /<[^>]*>/g;
const HTML_NUMERIC_ENTITY_RE = /&#(\d+);/g;
const HTML_HEX_ENTITY_RE = /&#x([a-fA-F0-9]+);/g;
const MULTI_NEWLINE_RE = /\n{3,}/g;
const SPACE_NOT_NEWLINE_RE = /[^\S\n]+/g;

// Pre-compiled entity regexes
const ENTITY_MAP: [RegExp, string][] = [
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
  [/&apos;/gi, "'"],
  [/&ndash;/gi, '–'],
  [/&mdash;/gi, '—'],
  [/&hellip;/gi, '…'],
  [/&copy;/gi, '©'],
  [/&reg;/gi, '®'],
  [/&trade;/gi, '™'],
  [/&bull;/gi, '•'],
];

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // Convert block-level elements to newlines before stripping tags
  text = text.replace(HTML_BLOCK_END_RE, '\n');
  text = text.replace(HTML_BR_RE, '\n');
  text = text.replace(HTML_LIST_RE, '\n');
  
  // Strip all remaining HTML tags
  text = text.replace(HTML_TAG_RE, '');
  
  // Decode common HTML entities using pre-compiled regexes
  for (const [re, char] of ENTITY_MAP) {
    text = text.replace(re, char);
  }
  
  // Decode numeric entities (&#60; &#x3C; etc.)
  text = text.replace(HTML_NUMERIC_ENTITY_RE, (_, num) => String.fromCharCode(parseInt(num, 10)));
  text = text.replace(HTML_HEX_ENTITY_RE, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Normalize multiple consecutive newlines to max 2
  text = text.replace(MULTI_NEWLINE_RE, '\n\n');
  
  // Normalize spaces (but not newlines)
  text = text.replace(SPACE_NOT_NEWLINE_RE, ' ');
  
  // Trim each line
  text = text.split('\n').map(line => line.trim()).join('\n');
  
  // Trim the whole result
  return text.trim();
}

// Shared type for authenticated app entries
export interface AuthAppEntry {
  app: {
    id: string;
    name: string;
    large_image?: string;
    categories?: string[];
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
  label?: string;
  id?: string;
}

export interface DeduplicatedApp {
  app: AuthAppEntry['app'];
  hasValidAuth: boolean;
  bestImage: string;
  instances: { label: string; isValidated: boolean }[];
}

/**
 * Deduplicate apps by normalized name.
 * - Normalizes names (lowercase, replaces spaces/underscores/hyphens)
 * - Prioritizes validated apps
 * - Collects best available image from any instance
 * - Tracks all auth instances for tooltip display
 */
export function deduplicateAuthApps(apps: AuthAppEntry[]): DeduplicatedApp[] {
  const appMap = new Map<string, DeduplicatedApp>();
  
  apps.forEach(auth => {
    if (!auth.active && !auth.validation?.valid) return; // Skip inactive/unvalidated
    
    // Normalize: lowercase, trim, replace spaces/underscores/hyphens for deduplication
    const normalizedName = auth.app.name.toLowerCase().trim().replace(/[\s_\-]+/g, '_');
    const existing = appMap.get(normalizedName);
    const isValidated = auth.validation?.valid === true;
    const entryImage = auth.app.large_image || '';
    const instance = {
      label: auth.label || auth.id || 'Default',
      isValidated,
    };
    
    if (!existing) {
      appMap.set(normalizedName, {
        app: auth.app,
        hasValidAuth: isValidated,
        bestImage: entryImage,
        instances: [instance],
      });
    } else {
      // Add instance to list
      existing.instances.push(instance);
      
      // Update hasValidAuth if this instance is valid
      if (isValidated) existing.hasValidAuth = true;
      
      // Collect best available image
      if (!existing.bestImage && entryImage) {
        existing.bestImage = entryImage;
      }
      
      // If new entry is validated and existing app wasn't from a validated source, update app info
      if (isValidated && !existing.app.large_image && entryImage) {
        existing.app = { ...existing.app, large_image: entryImage };
      }
    }
  });
  
  return Array.from(appMap.values());
}

/**
 * Deduplicate tasks by exact match on title + category + description.
 * Keeps the first occurrence (preserving order and IDs).
 */
export function deduplicateTasks<T>(tasks: T[]): T[] {
  if (!tasks || tasks.length === 0) return tasks;
  const seen = new Set<string>();
  return tasks.filter(task => {
    const t = task as any;
    if (t.disabled) return false; // Hide soft-deleted tasks
    const key = `${t.title ?? ''}\0${t.category ?? ''}\0${t.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Check if an assignee refers to the AI Agent.
 * Matches variations like "agent", "ai agent", "aiagent", "AI Agent", etc.
 */
export function isAIAssignee(assignee?: string): boolean {
  if (!assignee) return false;
  const normalized = assignee.toLowerCase().replace(/\s+/g, '');
  return normalized === 'agent' || normalized === 'aiagent' || normalized.includes('aiagent');
}
