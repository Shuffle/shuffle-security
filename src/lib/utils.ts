import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
