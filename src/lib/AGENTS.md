<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# lib

## Purpose
Core business logic library containing the entire data pipeline: web scraping from Korean platforms, AI-powered article generation and translation, hospital name matching, Firebase data access, internationalization config, and shared TypeScript types.

## Key Files

| File | Description |
|------|-------------|
| `scraper.ts` | Puppeteer-based scraper for Naver Place, KakaoMap, and Google Maps — extracts hospital details, reviews, ratings, images, and social links |
| `generator.ts` | Claude API (Sonnet) article generator — creates Korean articles from scraped data, then translates to 12 other languages in parallel |
| `publish.ts` | Publishing pipeline — manages keyword queue in Firestore, orchestrates scrape→generate→save workflow, provides article query functions |
| `keywords.ts` | Keyword/region database — generates all search keyword combinations from Korean regions (cities, districts, dongs, subway stations) x specialties (dental/dermatology) |
| `matcher.ts` | OpenAI GPT-based hospital name matcher — cross-references Naver hospitals with Kakao/Google results for accurate data merging |
| `firebase.ts` | Firebase Admin SDK initialization with lazy Firestore accessor — supports env vars and local service account file |
| `i18n.ts` | Internationalization config — 13 supported languages with names, HTML lang codes, directions, and full UI translation strings |
| `types.ts` | Shared TypeScript interfaces: `HospitalInfo`, `ReviewItem`, `KeywordEntry`, `Article`, `SupportedLang` |
| `regions-data.json` | Population data for Korean cities, districts, and dongs — used to prioritize keyword generation order |

## For AI Agents

### Working In This Directory
- All files are **server-only** — never import from client components
- `scraper.ts` and `generator.ts` are dynamically imported in `publish.ts` to avoid loading Puppeteer/Anthropic SDK during page renders
- `firebase.ts` uses a `Proxy` for lazy initialization so imports don't crash during Next.js build
- `matcher.ts` uses OpenAI's `gpt-5.4-mini` with `responses.create` API — not the chat completions API

### Testing Requirements
- Scraper functions require Chrome/Chromium installed locally or `@sparticuz/chromium` in serverless
- Generator requires `ANTHROPIC_API_KEY` env var
- Matcher requires `OPENAI_API_KEY` env var
- Firebase requires `FIREBASE_PRIVATE_KEY` or local service account JSON

### Common Patterns
- Scraper adds deliberate delays between requests (2-3s) to avoid rate limiting
- Generator prompts produce JSON responses parsed with regex fallbacks
- Keywords are ordered by population (descending) for SEO priority
- Article IDs follow pattern: `{category}-{slug}-{lang}` (e.g., `dental-gangnam-ko`)

## Dependencies

### Internal
- `types.ts` is imported by all other lib files
- `i18n.ts` is imported by `generator.ts` and all page components
- `firebase.ts` is imported by `publish.ts` and `api/comments/route.ts`

### External
- `puppeteer-core` + `@sparticuz/chromium` — headless browser for scraping
- `@anthropic-ai/sdk` — Claude API for content generation
- `openai` — GPT API for hospital matching
- `firebase-admin` — Firestore database

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
