<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# api

## Purpose
Next.js API routes powering the automated publishing pipeline and user comments system. All routes use `force-dynamic` rendering.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `cron/` | Vercel cron-triggered endpoint for automated article publishing (see below) |
| `publish/` | Manual publish trigger for testing (see below) |
| `comments/` | User comment CRUD API backed by Firestore (see below) |

## Key Routes

### `cron/route.ts`
- **Method**: GET
- **Auth**: `Bearer {CRON_SECRET}` header
- **Purpose**: Called by Vercel cron (12 times daily per `vercel.json`). Picks the next pending keyword from Firestore, scrapes hospital data, generates articles in all languages, and saves to Firestore.
- **Timeout**: 300s (5 min) for Vercel Pro

### `publish/route.ts`
- **Method**: POST
- **Auth**: `Bearer {ANTHROPIC_API_KEY}` header
- **Purpose**: Manual publish trigger for testing. Supports `action: 'init'` to initialize the keyword queue.

### `comments/route.ts`
- **Methods**: GET (fetch by articleId), POST (create comment)
- **Auth**: None (public)
- **Validation**: articleId required, content max 1000 chars, nickname max 30 chars (defaults to "익명")
- **Storage**: Firestore `comments` collection

## For AI Agents

### Working In This Directory
- All routes use `export const dynamic = 'force-dynamic'` to disable caching
- Cron and publish routes use `maxDuration = 300` for long-running scrape+generate operations
- The cron route is the primary production entry point — triggered automatically by Vercel
- Comments API has no rate limiting — consider adding if abuse occurs

### Testing Requirements
- Cron route requires `CRON_SECRET` env var
- Publish route requires `ANTHROPIC_API_KEY` env var for auth
- Both require Firebase credentials for Firestore access
- Test with: `curl -X POST -H "Authorization: Bearer $ANTHROPIC_API_KEY" http://localhost:3000/api/publish`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
