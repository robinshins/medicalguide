<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# [category]

## Purpose
Dynamic route segment for medical categories (`dental` or `dermatology`). Contains the category listing page and nested article detail pages.

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | Category listing page — displays all articles for the given category/language with breadcrumb nav, article cards in a responsive grid. ISR with 1800s revalidation. Pre-renders all 13 languages x 2 categories via `generateStaticParams` |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[slug]/` | Individual article detail pages (see `[slug]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `params` is `Promise<{ lang: string; category: string }>` — always await
- Category is either `'dental'` or `'dermatology'` — maps to localized names via `UI_TRANSLATIONS`
- Articles are fetched with `getArticles(lang, category, 50)` — limit of 50 per category
- Empty state is handled gracefully for when Firestore has no data yet

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
