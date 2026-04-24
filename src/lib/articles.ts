import { cache } from 'react';
import { db } from './firebase';
import type { Article, ArticleSummary } from './types';
import { readArticleIndex, readArticleIndexesAllCategories } from './articlesIndex';
import { SUPPORTED_LANGUAGES } from './i18n';

const DENTAL_COLLECTION = 'articles';
const DERMA_COLLECTION = 'articles_derma';

function getCollection(category?: string): string {
  return category === 'dermatology' ? DERMA_COLLECTION : DENTAL_COLLECTION;
}

// --- Get article summaries from pre-aggregated index (cheap: 1-2 reads) ---
// Use for home/category lists. Falls back to collection scan if index missing.
export async function getArticleSummaries(
  lang: string,
  category?: string,
  limit?: number,
): Promise<ArticleSummary[]> {
  const items = category
    ? await readArticleIndex(lang, category)
    : await readArticleIndexesAllCategories(lang);

  // Fallback: index not built yet → derive from full collection once.
  if (items.length === 0) {
    const articles = await getArticles(lang, category, limit);
    return articles.map(a => ({
      id: a.id,
      slug: a.slug,
      category: a.category,
      lang: a.lang,
      title: a.title,
      metaDescription: a.metaDescription,
      publishedAt: a.publishedAt,
      region: a.region,
      specialty: a.specialty,
    }));
  }

  return limit ? items.slice(0, limit) : items;
}

// --- Get published articles (full documents; expensive) ---
export async function getArticles(lang: string, category?: string, limit?: number): Promise<Article[]> {
  if (category) {
    const snapshot = await db.collection(getCollection(category))
      .where('lang', '==', lang)
      .get();
    const articles = snapshot.docs
      .map(doc => doc.data() as Article)
      .filter(a => a.category === category);
    articles.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    return limit ? articles.slice(0, limit) : articles;
  }

  const [dentalSnap, dermaSnap] = await Promise.all([
    db.collection(DENTAL_COLLECTION).where('lang', '==', lang).get(),
    db.collection(DERMA_COLLECTION).where('lang', '==', lang).get(),
  ]);

  // Drop cross-site contamination: trust collection over doc.category field.
  const articles = [
    ...dentalSnap.docs
      .map(doc => doc.data() as Article)
      .filter(a => a.category !== 'dermatology'),
    ...dermaSnap.docs
      .map(doc => doc.data() as Article)
      .filter(a => a.category !== 'dental'),
  ];
  articles.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return limit ? articles.slice(0, limit) : articles;
}

// --- Get single article ---
// Wrapped in React cache() so generateMetadata + page render in the same
// request share one Firestore lookup instead of hitting it twice.
//
// Tries multiple doc ID forms because Next.js 16 passes `slug` differently to
// generateMetadata (often still percent-encoded) vs the page component (decoded).
// Additionally, some legacy articles were saved with slugs like
// "%eb%aa%a9%ed%8f%ac%ec%8b%9c-implant" — literal lowercase percent-encoded Korean.
export const getArticle = cache(async (lang: string, category: string, slug: string): Promise<Article | null> => {
  const col = db.collection(getCollection(category));

  // Normalize: decode in case the slug is still percent-encoded. Already-decoded
  // Korean passes through unchanged.
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* malformed, keep raw */ }

  const encodedLower = encodeURIComponent(decoded).toLowerCase();

  // Try each candidate form; dedupe so we don't hit Firestore more than needed.
  const candidates = Array.from(new Set([
    `${category}-${slug}-${lang}`,         // raw param
    `${category}-${decoded}-${lang}`,      // decoded (e.g. "안성시")
    `${category}-${encodedLower}-${lang}`, // legacy lowercase-encoded (e.g. "%ec%95%88...")
  ]));

  for (const id of candidates) {
    const doc = await col.doc(id).get();
    if (doc.exists) return doc.data() as Article;
  }

  return null;
});

// --- Get all article slugs for sitemap (cheap: reads ≤26 index docs) ---
// Replaces a full collection scan (12K+ docs/day × crawler frequency) with
// a bounded read of the pre-aggregated indexes. Each index holds the latest
// 500 items per (category, lang) — ample headroom for current volume.
//
// NOTE: if any (category, lang) grows past 500 items, older slugs drop from
// this output. When that becomes a real concern, split into sub-sitemaps or
// add a paged index.
export async function getAllArticleSlugsFromIndex(): Promise<{ lang: string; category: string; slug: string }[]> {
  const tasks: Promise<ArticleSummary[]>[] = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    tasks.push(readArticleIndex(lang, 'dental'));
    tasks.push(readArticleIndex(lang, 'dermatology'));
  }
  const results = await Promise.all(tasks);
  const out: { lang: string; category: string; slug: string }[] = [];
  for (const items of results) {
    for (const item of items) {
      if (item.lang && item.slug && item.category) {
        out.push({ lang: item.lang, category: item.category, slug: item.slug });
      }
    }
  }
  return out;
}

// --- Get all articles for sitemap (expensive fallback; full collection scan) ---
// Prefer getAllArticleSlugsFromIndex. Retained for recovery / debugging.
// Filters out cross-site contamination: the shared Firebase project may have
// foreign docs whose `category` field disagrees with the collection they live
// in. Collection name is the source of truth — we drop any doc whose own
// category field contradicts the collection.
export async function getAllArticleSlugs(): Promise<{ lang: string; category: string; slug: string }[]> {
  const [dentalSnap, dermaSnap] = await Promise.all([
    db.collection(DENTAL_COLLECTION).select('lang', 'category', 'slug').get(),
    db.collection(DERMA_COLLECTION).select('lang', 'category', 'slug').get(),
  ]);

  const dental = dentalSnap.docs
    .map(doc => doc.data())
    .filter(d => d.lang && d.slug && d.category !== 'dermatology')
    .map(d => ({ lang: d.lang, category: 'dental', slug: d.slug }));

  const derma = dermaSnap.docs
    .map(doc => doc.data())
    .filter(d => d.lang && d.slug && d.category !== 'dental')
    .map(d => ({ lang: d.lang, category: 'dermatology', slug: d.slug }));

  return [...dental, ...derma];
}
