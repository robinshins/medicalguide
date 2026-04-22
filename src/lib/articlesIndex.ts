import { db } from './firebase';
import type { Article, ArticleSummary } from './types';

const INDEX_COLLECTION = 'articles-index';
export const MAX_ITEMS_PER_INDEX = 500;

function indexId(category: string, lang: string): string {
  return `${category}-${lang}`;
}

export function toArticleSummary(article: Article): ArticleSummary {
  return {
    id: article.id,
    slug: article.slug,
    category: article.category,
    lang: article.lang,
    title: article.title,
    metaDescription: article.metaDescription,
    publishedAt: article.publishedAt,
    region: article.region,
    specialty: article.specialty,
  };
}

// Atomic upsert: reads, merges, caps to MAX, writes back.
// Safe under concurrent publishes via Firestore transaction.
export async function upsertArticleIndex(article: Article): Promise<void> {
  const ref = db.collection(INDEX_COLLECTION).doc(indexId(article.category, article.lang));
  const summary = toArticleSummary(article);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing: ArticleSummary[] = snap.exists ? ((snap.data()?.items as ArticleSummary[]) || []) : [];
    const filtered = existing.filter(s => s.id !== summary.id);
    filtered.push(summary);
    filtered.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    const capped = filtered.slice(0, MAX_ITEMS_PER_INDEX);
    tx.set(ref, {
      category: article.category,
      lang: article.lang,
      items: capped,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function readArticleIndex(lang: string, category: string): Promise<ArticleSummary[]> {
  const ref = db.collection(INDEX_COLLECTION).doc(indexId(category, lang));
  const snap = await ref.get();
  if (!snap.exists) return [];
  return ((snap.data()?.items as ArticleSummary[]) || []);
}

export async function readArticleIndexesAllCategories(lang: string): Promise<ArticleSummary[]> {
  const [dental, derma] = await Promise.all([
    readArticleIndex(lang, 'dental'),
    readArticleIndex(lang, 'dermatology'),
  ]);
  const merged = [...dental, ...derma];
  merged.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return merged;
}
