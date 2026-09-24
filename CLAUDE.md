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
    → generator.ts (Vercel backup path, still claude-sonnet-5 → GPT-5.4-mini)
    → publish-action.js (the real GitHub Actions path: gpt-6-luna Korean article → deepseek-flash (DeepSeek-V4.1-Flash) 12 language translations, since 2026-09-24)
    → publish.ts (orchestrator: queue management + Firestore save)
```

This pipeline runs via:
- **GitHub Actions** (`.github/workflows/publish.yml`) — 12x daily, hourly KST 09:00–20:00, with a 0-10min random delay. Halved from 24x/day on 2026-07-23 while the Naver search-exposure drop is observed.
- `/api/cron` — manual/backup trigger only. `vercel.json` no longer schedules it (its only cron is `/api/indexnow`).

**Queue mechanics (`publish-action.js`)** — the queue reads `status=='pending'` ordered by `order` asc:
- A failed keyword retries up to `MAX_ATTEMPTS` (3) by going back to `pending`; only then is it marked `failed`. Before this existed, one failure removed a keyword from the queue forever, which is how the highest-population keywords ended up unpublished while lower-priority ones went out.
- `reclaimStaleInProgress()` returns any keyword stuck in `in_progress` past `STALE_IN_PROGRESS_MS` (1h) to `pending`, covering runners that die mid-publish. It is category-agnostic, so it reclaims dermatology keywords in this collection too.
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

**This project is the sole publisher of dental articles.** The sibling site `medicalkoreaguide_derma`
(www.medicalkoreaguide.com) shares this Firebase project and had a `godeok-publish.js` that also wrote
`articles/dental-{slug}-{lang}` — the exact doc IDs this project owns. On 2026-07-22 both ran at once and
clobbered the same 156 docs. That script is now guarded off; dental publishing must happen only from here.

**Never** trust a document's own `category` field to decide where it lives. The Firebase project is shared across multiple sites, and the `articles` collection contains foreign docs with `category='dermatology'` that belong to other sites — ignore them. Always route by collection.

Dermatology publishing for **this** site has not started yet, so `articles_derma` is empty and dermatology category pages correctly show nothing. Once the dermatology pipeline runs, writes MUST go to `articles_derma`.

### Index maintenance

- `node rebuild-articles-index.js` — one-shot backfill of `articles-index/` docs from the two article collections. Run after `ArticleSummary` schema changes or to recover from drift.
- Publish paths call `upsertArticleIndex()` automatically; manual rebuild is only for recovery.
- Index caps at 500 items per `{category}-{lang}` (~250KB, safe under 1MB). Category pages fall back to a full collection scan for page 6+ or search queries.

### Environment Variables

Required: `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`
