<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 | Updated: 2026-03-22 -->

# public

## Purpose
Static assets served at the root URL. Contains decorative shape images used in the hero sections, trust cards, and article pages.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `img/` | PNG decorative shape images (shape-1.png through shape-20.png) used as background elements |
| `shapes/` | SVG decorative shapes collection (56 SVG files) — not currently referenced in code |

## For AI Agents

### Working In This Directory
- Images are referenced via `/img/shape-N.png` in Next.js `Image` components
- The `shapes/` directory SVGs are available but not actively used in the current design
- When adding new images, use descriptive filenames and update references in page components

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
