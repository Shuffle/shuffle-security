/**
 * Re-export shim — the canonical usecase catalog now lives in Shuffle-Core
 * (`@/Shuffle-Core/config/usecases`). Keep this file so existing host imports
 * (`@/config/usecases`) continue to resolve without duplicating the catalog.
 */
export * from '@/Shuffle-Core/config/usecases';
