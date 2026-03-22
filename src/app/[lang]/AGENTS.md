<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# [lang]

## Purpose
Language-segmented route group providing i18n support for 13 languages. Contains the main HTML layout with header/footer, the home page with hero and article listings, and nested category/article pages.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Main HTML layout — renders `<html>`, `<body>`, sticky header with nav (Dental/Dermatology links + language switcher), and dark footer with data source credits |
| `page.tsx` | Home page — hero section, trust cards, 4-step process explanation, latest dental and dermatology article grids, and CTA section. Uses ISR with 1800s revalidation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[category]/` | Category listing and individual article pages for dental/dermatology (see `[category]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `params` is `Promise<{ lang: string }>` in Next.js 16 — always `await params`
- `generateStaticParams` pre-renders all 13 language variants
- `generateMetadata` produces per-language SEO metadata with `alternates.languages` for hreflang
- The layout renders the full HTML document — the root `app/layout.tsx` only passes children through
- Language validation: falls back to `'ko'` if an unsupported lang is provided

### Common Patterns
- UI text comes from `UI_TRANSLATIONS[lang]` — never hardcode strings
- Only `ko` and `en` have inline fallback strings in some sections; other languages use the translation object
- Article listings fetch from Firestore via `getArticles()` with try/catch for pre-data states
- Decorative `Image` components use `/img/shape-N.png` assets

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
