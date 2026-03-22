<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# [slug]

## Purpose
Individual article detail page displaying AI-generated hospital review content with structured data, hospital cards, comments, and cross-language navigation.

## Key Files

| File | Description |
|------|-------------|
| `page.tsx` | Article detail page — the most complex page in the app. Features: dark hero header with breadcrumbs, article HTML content (emoji-stripped), hospital info cards with ratings from 3 platforms (Naver/Kakao/Google), map links, social links, specialist badges, data source disclaimer, Comments component, language selector, and JSON-LD structured data (Article, ItemList, FAQPage schemas) |

## For AI Agents

### Working In This Directory
- `params` is `Promise<{ lang: string; category: string; slug: string }>` — always await
- `dynamicParams = true` allows on-demand rendering of unknown slugs
- ISR with 3600s revalidation (1 hour)
- Article content is raw HTML rendered via `dangerouslySetInnerHTML` — styles come from `.article-content` in `globals.css`
- `stripEmojis()` removes all emoji characters from generated content before rendering
- `buildJsonLd()` generates 3 structured data schemas: Article, ItemList (hospitals), FAQPage (extracted from content)
- Hospital cards display ratings from up to 3 platforms with color-coded badges (green=Naver, amber=Kakao, blue=Google)
- External links to Naver Place, KakaoMap, Google Maps open in new tabs with `noopener noreferrer`
- The `Comments` client component is embedded at the bottom
- A language selector bar shows all 13 languages linking to the same article in different languages

### Common Patterns
- Article ID format: `{category}-{slug}-{lang}` used to fetch from Firestore
- `notFound()` is called when article doesn't exist
- Helper components `MapIcon` and `LinkIcon` are defined inline as SVG components

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
