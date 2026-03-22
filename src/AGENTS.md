<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# src

## Purpose
Application source code containing the Next.js App Router pages, API routes, React components, and core business logic libraries for scraping, content generation, and data management.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router — layouts, pages, API routes, and components (see `app/AGENTS.md`) |
| `lib/` | Core business logic — scraping, AI generation, Firebase, i18n, types (see `lib/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Use `@/*` import alias (maps to `./src/*`) for all imports
- `app/` follows Next.js App Router conventions with `[lang]` dynamic segment for i18n
- `lib/` contains server-only code — never import directly from client components

### Common Patterns
- Server Components are the default; client components are marked with `'use client'`
- Heavy dependencies (Puppeteer, Anthropic SDK) are dynamically imported to avoid bundling in page renders

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
