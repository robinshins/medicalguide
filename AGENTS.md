<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# medicalkoreaguide

## Purpose
A multilingual medical tourism SEO website built with Next.js 16, providing automated hospital review guides for dental and dermatology clinics across South Korea. The system scrapes real reviews from Naver Place, KakaoMap, and Google Maps, cross-references with official HIRA (Health Insurance Review & Assessment Service) data, generates AI-written articles via Claude API, translates them into 13 languages, and publishes them to Firebase Firestore. Deployed on Vercel with automated cron-based publishing.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies: Next.js 16, React 19, Firebase Admin, Anthropic SDK, OpenAI SDK, Puppeteer |
| `next.config.ts` | Next.js config with Naver/Kakao/Kakao CDN image domains and server external packages |
| `vercel.json` | 12 daily cron schedules triggering `/api/cron` for automated article publishing |
| `tsconfig.json` | TypeScript strict mode, `@/*` path alias to `./src/*` |
| `tailwind.config.js` | Tailwind CSS 3 with dark mode class strategy |
| `eslint.config.mjs` | ESLint 9 with next config |
| `postcss.config.js` | PostCSS with Tailwind and Autoprefixer |
| `medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json` | Firebase service account key (local dev only, DO NOT commit) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Application source code (see `src/AGENTS.md`) |
| `public/` | Static assets — decorative images and SVG shapes (see `public/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- This is a Next.js 16 project — **read `node_modules/next/dist/docs/` before making changes** as APIs may differ from training data
- Use `@/*` import alias for `src/` directory imports
- Environment variables required: `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`
- The Firebase service account JSON file must NOT be committed to git

### Testing Requirements
- `npm run build` — full production build verification
- `npm run lint` — ESLint checks
- No test framework is currently configured

### Common Patterns
- Server-side rendering with `revalidate` for ISR (Incremental Static Regeneration)
- Dynamic imports to avoid loading heavy SDKs (Puppeteer, Anthropic) during page renders
- Firestore queries avoid composite indexes by sorting in JavaScript
- All 13 supported languages: ko, en, zh-TW, zh-CN, ja, vi, th, ru, es, es-MX, pt-BR, de, it

## Dependencies

### External
- `next` 16.2.0 — App Router framework
- `react` / `react-dom` 19.2.4 — UI library
- `firebase-admin` 13.7.0 — Firestore database access
- `@anthropic-ai/sdk` 0.80.0 — Article generation and translation via Claude
- `openai` 6.32.0 — Hospital name matching via GPT
- `puppeteer-core` + `@sparticuz/chromium` — Headless browser scraping
- `tailwindcss` 3.4.19 — Utility-first CSS

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
