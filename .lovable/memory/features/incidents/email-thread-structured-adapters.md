---
name: Email thread structured adapters
description: EmailThreadPanel prefers rawOCSF.unmapped_original (Gmail/Outlook/generic) over regex parsing of description
type: feature
---
EmailThreadPanel resolves messages in this priority order:
1. `resolveEmailThread(rawOCSF)` from `src/lib/emailThreadAdapters.ts` — handles Gmail (`messages[].payload.headers/parts`), Outlook Graph (`value[]` or single), and generic single-envelope shapes.
2. Legacy `parseEmailThread(descriptionText, descriptionHtml)` regex fallback.

Adapters live in `src/lib/emailThreadAdapters.ts`. They normalise to `EmailMessage[]` and sort newest-first. Gmail bodies are base64url-decoded from MIME parts; Outlook HTML bodies are passed through as `bodyHtml` and rendered with DOMPurify. A small source chip (Gmail/Outlook/Email) appears in the panel header when the structured path was used.

`isEmailContent()` returns true when `resolveEmailThread()` matches, ensuring the panel shows for any provider payload even if the description text is empty/translated away.
