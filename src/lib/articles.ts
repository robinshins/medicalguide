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
    const articles = snapshot.docs.map(doc => doc.data() as Article);
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
export async function getArticle(lang: string, category: string, slug: string): Promise<Article | null> {
  const id = `${category}-${slug}-${lang}`;
  const doc = await db.collection(getCollection(category)).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Article;
}

// --- Get all articles for sitemap ---
export async function getAllArticleSlugs(): Promise<{ lang: string; category: string; slug: string }[]> {
  const [dentalSnap, dermaSnap] = await Promise.all([
    db.collection(DENTAL_COLLECTION).select('lang', 'category', 'slug').get(),
    db.collection(DERMA_COLLECTION).select('lang', 'category', 'slug').get(),
  ]);

  return [
    ...dentalSnap.docs.map(doc => {
      const d = doc.data();
      return { lang: d.lang, category: d.category, slug: d.slug };
    }),
    ...dermaSnap.docs.map(doc => {
      const d = doc.data();
      return { lang: d.lang, category: d.category, slug: d.slug };
    }),
  ];
}
