<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# components

## Purpose
Shared React client components used across multiple pages.

## Key Files

| File | Description |
|------|-------------|
| `Comments.tsx` | Client component for article comments — fetches/posts via `/api/comments`, supports nickname (optional) and content with character limit. Bilingual UI (ko/en fallback) |
| `LangDropdown.tsx` | Client component for language switching — dropdown with all 13 languages, replaces lang segment in current URL path. Uses click-outside detection |

## For AI Agents

### Working In This Directory
- Both components are `'use client'` — they use React hooks (useState, useEffect, useRef, useCallback)
- `Comments.tsx` is used in the article detail page (`[lang]/[category]/[slug]/page.tsx`)
- `LangDropdown.tsx` is available but the main layout uses a CSS-only hover dropdown instead
- When adding new components, follow the pattern: client directive at top, props interface, bilingual text support

### Common Patterns
- Bilingual UI with `isKo` flag for Korean vs English fallback text
- Fetch API calls to internal `/api/` routes
- Tailwind CSS for all styling — no CSS modules or styled-components

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
