import { db } from './firebase';
import type { Article } from './types';

const DENTAL_COLLECTION = 'articles';
const DERMA_COLLECTION = 'articles_derma';

function getCollection(category?: string): string {
  return category === 'dermatology' ? DERMA_COLLECTION : DENTAL_COLLECTION;
}

// --- Get published articles ---
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

  const articles = [
    ...dentalSnap.docs.map(doc => doc.data() as Article),
    ...dermaSnap.docs.map(doc => doc.data() as Article),
  ];
  articles.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return limit ? articles.slice(0, limit) : articles;
}

// --- Get single article ---
// Tries multiple doc ID forms because Next.js 16 passes `slug` differently to
// generateMetadata (often still percent-encoded) vs the page component (decoded).
// Additionally, some legacy articles were saved with slugs like
// "%eb%aa%a9%ed%8f%ac%ec%8b%9c-implant" — literal lowercase percent-encoded Korean.
export async function getArticle(lang: string, category: string, slug: string): Promise<Article | null> {
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
}

// --- Get all articles for sitemap ---
export async function getAllArticleSlugs(): Promise<{ lang: string; category: string; slug: string }[]> {
  const [dentalSnap, dermaSnap] = await Promise.all([
    db.collection(DENTAL_COLLECTION).select('lang', 'category', 'slug').get(),
    db.collection(DERMA_COLLECTION).select('lang', 'category', 'slug').get(),
  ]);

  return [
    ...dentalSnap.docs
      .map(doc => {
        const d = doc.data();
        return { lang: d.lang, category: d.category, slug: d.slug };
      })
      .filter(a => a.category === 'dental'),
    ...dermaSnap.docs.map(doc => {
      const d = doc.data();
      return { lang: d.lang, category: d.category, slug: d.slug };
    }),
  ];
}
