/**
 * Helpers for rendering third-party HTML (emails, webhook payloads, etc.)
 * inside our themed UI.
 *
 * The problem: provider-generated HTML — Gmail, Outlook, Notion comment
 * notifications, Jira, etc. — almost always hard-codes `color: #333` style
 * text on a `background: #fff` card. Pasted onto our dark theme that becomes
 * dark-on-dark and effectively invisible (see the "Notion Team" email
 * thread bug, Apr 2026). DOMPurify keeps the styles because they are not a
 * security issue — but they ARE a readability issue.
 *
 * The fix: after sanitization, strip every color-related declaration from
 * inline `style="..."` attributes so the content inherits OUR theme color.
 * The host element should additionally apply `color: inherit !important`
 * via CSS to catch anything we miss (e.g. <font color>, classed styles).
 *
 * Use `stripColorStyles` for any place we render untrusted/foreign HTML
 * with `dangerouslySetInnerHTML`.
 */

/** Style properties that affect visible color and must be removed so the
 *  content adapts to the host theme. Order matters only for readability. */
const COLOR_PROPERTIES = [
  'color',
  'background',
  'background-color',
  'background-image',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
  '-webkit-text-fill-color',
];

const COLOR_PROP_RE = new RegExp(
  `(?:^|;)\\s*(?:${COLOR_PROPERTIES.join('|')})\\s*:[^;]*`,
  'gi',
);

/**
 * Remove color-related declarations from inline `style="..."` attributes,
 * and drop legacy `bgcolor`/`color` attributes entirely. Preserves layout
 * styles (margin, padding, font-size, etc.) so the email still looks like
 * itself — just in our palette.
 */
export const stripColorStyles = (html: string): string => {
  if (!html) return '';
  // 1. Clean up `style="..."` attributes.
  let out = html.replace(/style\s*=\s*"([^"]*)"/gi, (_match, decls: string) => {
    const cleaned = decls
      .replace(COLOR_PROP_RE, '')
      .replace(/^\s*;+/, '')
      .replace(/;\s*;+/g, ';')
      .trim();
    return cleaned ? `style="${cleaned}"` : '';
  });
  // 2. Same for single-quoted variants (rare but legal).
  out = out.replace(/style\s*=\s*'([^']*)'/gi, (_match, decls: string) => {
    const cleaned = decls
      .replace(COLOR_PROP_RE, '')
      .replace(/^\s*;+/, '')
      .replace(/;\s*;+/g, ';')
      .trim();
    return cleaned ? `style='${cleaned}'` : '';
  });
  // 3. Strip legacy presentational color attributes that DOMPurify might keep
  //    if the caller didn't FORBID_ATTR them.
  out = out.replace(/\s(?:bgcolor|color)\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\s(?:bgcolor|color)\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\s(?:bgcolor|color)\s*=\s*[^\s>]+/gi, '');
  return out;
};
