# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Start development server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `node test-publish.js` — Publish 1 article locally (scrape + generate + translate + save)

No test framework is configured.

## Architecture

Medical Korea Guide is an automated multilingual SEO content platform for Korean healthcare tourism. It generates hospital review articles by scraping real data, creating AI content, and publishing to Firestore.

### Data Pipeline (server-side, `src/lib/`)

```
keywords.ts (9,025 region × specialty combinations, ordered by population)
    → scraper.ts (Puppeteer: Naver Place + KakaoMap + Google Maps)
    → matcher.ts (GPT-5.4-mini: cross-platform hospital name/address matching)
    → generator.ts (Claude Sonnet: Korean article → GPT-5.4-mini: 12 language translations)
    → publish.ts (orchestrator: queue management + Firestore save)
```

This pipeline runs via:
- **GitHub Actions** (`.github/workflows/publish.yml`) — 24x daily at random intervals with 0-10min random delay
- `/api/cron` (Vercel cron, 12x daily) — backup trigger
- `/api/publish` (manual POST trigger)
- `node test-publish.js` (local testing)

### Frontend (Next.js 16 App Router)

Routes follow `[lang]/[category]/[slug]` pattern supporting 13 languages × 2 categories (dental, dermatology). Article content is server-generated HTML rendered via `dangerouslySetInnerHTML` with styles in `.article-content` (globals.css).

### Key Conventions

- **Next.js 16 breaking change**: `params` is a `Promise` — always `await params` before accessing properties
- **Import alias**: `@/*` maps to `src/*`
- **Server-only libs**: Everything in `src/lib/` must never be imported from client components
- **Dynamic imports**: Puppeteer (`scraper.ts`) and Anthropic SDK (`generator.ts`) are dynamically imported in `publish.ts` to avoid bundling in page renders
- **Firebase lazy init**: `firebase.ts` uses a Proxy so imports don't crash during build
- **UI text**: Always use `UI_TRANSLATIONS[lang]` from `src/lib/i18n.ts` — never hardcode user-facing strings
- **Article IDs**: Follow pattern `{category}-{slug}-{lang}` (e.g., `dental-gangnam-ko`)
- **ISR**: Home/category pages revalidate at 7200s (2h), article detail at 3600s (1h)
- **Scraper delays**: 2-3s between requests to avoid rate limiting on Naver/Kakao
- **Firestore queries**: Avoid composite indexes — sort in JavaScript instead
- **No emojis**: Neither in UI code nor in Claude-generated article content

### Firestore collections (IMPORTANT — collection name is the source of truth for category)

| Collection | Contents |
|---|---|
| `articles` | **dental** articles only |
| `articles_derma` | **dermatology** articles only |
| `articles-index` | pre-aggregated summaries, doc id `{category}-{lang}` (e.g. `dental-ko`), latest 500 items each |
| `keywords` | publish queue (9,025 docs) |
| `comments` | user comments |

Mapping (keep in sync across all three sites):

```
category === 'dermatology' ? 'articles_derma' : 'articles'
```

- `src/lib/articles.ts::getCollection()`
- `src/lib/publish.ts::getArticlesCollection()`
- `publish-action.js::articlesCollectionFor()`

**Never** trust a document's own `category` field to decide where it lives. The Firebase project is shared across multiple sites, and the `articles` collection contains foreign docs with `category='dermatology'` that belong to other sites — ignore them. Always route by collection.

Dermatology publishing for **this** site has not started yet, so `articles_derma` is empty and dermatology category pages correctly show nothing. Once the dermatology pipeline runs, writes MUST go to `articles_derma`.

### Index maintenance

- `node rebuild-articles-index.js` — one-shot backfill of `articles-index/` docs from the two article collections. Run after `ArticleSummary` schema changes or to recover from drift.
- Publish paths call `upsertArticleIndex()` automatically; manual rebuild is only for recovery.
- Index caps at 500 items per `{category}-{lang}` (~250KB, safe under 1MB). Category pages fall back to a full collection scan for page 6+ or search queries.

### Environment Variables

Required: `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`
