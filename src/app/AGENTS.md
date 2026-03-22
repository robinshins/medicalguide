<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# app

## Purpose
Next.js App Router directory containing the root layout, i18n-based dynamic routing (`[lang]`), API routes, and shared React components. The root page redirects to `/ko` (Korean).

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — imports globals.css, renders children without wrapping HTML (delegated to `[lang]/layout.tsx`) |
| `page.tsx` | Root page — redirects to `/ko` |
| `globals.css` | Global styles: Tailwind directives + `.article-content` typography styles for generated HTML articles |
| `sitemap.ts` | Dynamic sitemap generator for all language/category combinations |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[lang]/` | Language-segmented pages with layout, home, category, and article pages (see `[lang]/AGENTS.md`) |
| `api/` | API routes for cron jobs, manual publishing, and comments (see `api/AGENTS.md`) |
| `components/` | Shared React components (see `components/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- The root `layout.tsx` intentionally does NOT render `<html>` or `<body>` — those are in `[lang]/layout.tsx`
- `globals.css` contains critical `.article-content` styles for server-generated HTML content — do not remove these
- `sitemap.ts` generates entries for all 13 languages x 2 categories; dynamic article slugs will be added when Firestore has data

### Common Patterns
- Pages use `revalidate` for ISR (1800s for listings, 3600s for articles)
- `params` is a `Promise` in Next.js 16 — always `await params` before accessing properties
- All pages validate `lang` against `SUPPORTED_LANGUAGES` with fallback to `'ko'`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
