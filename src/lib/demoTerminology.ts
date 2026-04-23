/**
 * Replaces the literal word "incident"/"incidents" in demo-mode copy with the
 * org's configured entity terminology (Alert, Case, Ticket, …) so the demo
 * tour and CTA reflect the same wording the rest of the app uses.
 *
 * Case is preserved: "Incident" → "Case", "incidents" → "cases", etc.
 */
export const applyEntityTerminology = (
  text: string,
  singular: string,
  plural: string,
): string => {
  if (!text) return text;
  // Skip when the configured terminology is already "Incident" — no-op.
  if (singular.toLowerCase() === 'incident') return text;
  return text
    // Plural variants first (longer match wins).
    .replace(/\bIncidents\b/g, plural)
    .replace(/\bincidents\b/g, plural.toLowerCase())
    // Then singular.
    .replace(/\bIncident\b/g, singular)
    .replace(/\bincident\b/g, singular.toLowerCase());
};
