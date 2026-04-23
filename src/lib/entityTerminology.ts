/**
 * Centralised terminology helper. The org can rename the "Incident" entity to
 * Alert / Case / Ticket / Job (see /preferences). Every user-facing string in
 * the platform that mentions "incident" or "incidents" should be passed
 * through `applyEntityTerminology` (or the React `useEntityText` hook below)
 * so the UI matches the configured wording.
 *
 * Case is preserved:
 *   "Incident not found"   → "Case not found"
 *   "Search incidents…"    → "Search cases…"
 *   "an incident"          → "a case"   (article fix-up included)
 */

const isVowel = (c: string) => /[aeiouAEIOU]/.test(c);

/** Fix "a Case" → "a Case" or "a Alert" → "an Alert". Only touches the exact
 *  patterns "a "/"A "/"an "/"An " followed by the swapped singular. */
const fixArticles = (text: string, singular: string): string => {
  const startsWithVowel = isVowel(singular[0] ?? '');
  // a Alert → an Alert
  if (startsWithVowel) {
    text = text
      .replace(new RegExp(`\\ba ${singular}\\b`, 'g'), `an ${singular}`)
      .replace(new RegExp(`\\bA ${singular}\\b`, 'g'), `An ${singular}`);
  } else {
    // an Case → a Case
    text = text
      .replace(new RegExp(`\\ban ${singular}\\b`, 'g'), `a ${singular}`)
      .replace(new RegExp(`\\bAn ${singular}\\b`, 'g'), `A ${singular}`);
  }
  return text;
};

export const applyEntityTerminology = (
  text: string,
  singular: string,
  plural: string,
): string => {
  if (!text) return text;
  // No-op for the default terminology.
  if (singular.toLowerCase() === 'incident') return text;
  let out = text
    // Plural variants first (longer match wins).
    .replace(/\bIncidents\b/g, plural)
    .replace(/\bincidents\b/g, plural.toLowerCase())
    .replace(/\bINCIDENTS\b/g, plural.toUpperCase())
    // Then singular.
    .replace(/\bIncident\b/g, singular)
    .replace(/\bincident\b/g, singular.toLowerCase())
    .replace(/\bINCIDENT\b/g, singular.toUpperCase());
  out = fixArticles(out, singular);
  return out;
};
