# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Start development server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint check

No test framework is configured.

## Architecture

Medical Korea Guide is an automated multilingual SEO content platform for Korean healthcare tourism. It generates hospital review articles by scraping real data, creating AI content, and publishing to Firestore.

### Data Pipeline (server-side, `src/lib/`)

```
keywords.ts (region x specialty combinations, ordered by population)
    → scraper.ts (Puppeteer: Naver Place + KakaoMap + Google Maps)
    → matcher.ts (OpenAI GPT: cross-platform hospital matching)
    → generator.ts (Claude API: Korean article → 12 language translations)
    → publish.ts (orchestrator: queue management + Firestore save)
```

This pipeline runs via `/api/cron` (Vercel cron, 12x daily) or `/api/publish` (manual trigger).

### Frontend (Next.js 16 App Router)

Routes follow `[lang]/[category]/[slug]` pattern supporting 13 languages × 2 categories (dental, dermatology). Article content is server-generated HTML rendered via `dangerouslySetInnerHTML` with styles in `.article-content` (globals.css).

### Key Conventions

- **Next.js 16 breaking change**: `params` is a `Promise` — always `await params` before accessing properties. Read `node_modules/next/dist/docs/` before writing new route code.
- **Import alias**: `@/*` maps to `src/*`
- **Server-only libs**: Everything in `src/lib/` must never be imported from client components
- **Dynamic imports**: Puppeteer (`scraper.ts`) and Anthropic SDK (`generator.ts`) are dynamically imported in `publish.ts` to avoid bundling in page renders
- **Firebase lazy init**: `firebase.ts` uses a Proxy so imports don't crash during build
- **UI text**: Always use `UI_TRANSLATIONS[lang]` from `src/lib/i18n.ts` — never hardcode user-facing strings
- **Article IDs**: Follow pattern `{category}-{slug}-{lang}` (e.g., `dental-gangnam-ko`)
- **ISR**: Category pages revalidate at 1800s, articles at 3600s
- **Scraper delays**: 2-3s between requests to avoid rate limiting on Naver/Kakao

### Environment Variables

Required: `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`
