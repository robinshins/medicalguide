import { db } from './firebase';
import type { KeywordEntry, Article } from './types';

const KEYWORDS_COLLECTION = 'keywords';
const ARTICLES_COLLECTION = 'articles';

// --- Initialize keyword queue in Firestore ---
export async function initializeKeywordQueue(): Promise<number> {
  const { generateAllKeywords } = await import('./keywords');
  const keywords = generateAllKeywords();
  const batch = db.batch();
  let count = 0;

  for (const kw of keywords) {
    const ref = db.collection(KEYWORDS_COLLECTION).doc(kw.id);
    const doc = await ref.get();
    if (!doc.exists) {
      batch.set(ref, kw);
      count++;
    }
    // Firestore batches support max 500 operations
    if (count > 0 && count % 450 === 0) {
      await batch.commit();
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`[Publish] Initialized ${count} new keywords (total: ${keywords.length})`);
  return count;
}

// --- Get next pending keyword ---
export async function getNextPendingKeyword(): Promise<KeywordEntry | null> {
  const snapshot = await db.collection(KEYWORDS_COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('order', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as KeywordEntry;
}

// --- Publish a single article ---
export async function publishArticle(): Promise<{ success: boolean; keyword?: string; articlesCreated?: number; error?: string }> {
  try {
    // Initialize queue if needed
    const queueCheck = await db.collection(KEYWORDS_COLLECTION).limit(1).get();
    if (queueCheck.empty) {
      console.log('[Publish] Queue empty, initializing...');
      await initializeKeywordQueue();
    }

    // Get next keyword
    const keyword = await getNextPendingKeyword();
    if (!keyword) {
      return { success: false, error: 'No pending keywords' };
    }

    console.log(`[Publish] Processing keyword: ${keyword.keyword}`);

    // Mark as in_progress
    await db.collection(KEYWORDS_COLLECTION).doc(keyword.id).update({
      status: 'in_progress',
    });

    try {
      // Scrape hospital data (dynamic import to avoid loading puppeteer on page renders)
      const { scrapeHospitalData } = await import('./scraper');
      const hospitals = await scrapeHospitalData(keyword.keyword);

      if (hospitals.length === 0) {
        // Try without specialty
        console.log('[Publish] No results with specialty, trying region-only search');
        const categoryLabel = keyword.category === 'dental' ? '치과' : '피부과';
        const fallbackQuery = `${keyword.region} ${categoryLabel}`;
        const fallbackHospitals = await scrapeHospitalData(fallbackQuery);

        if (fallbackHospitals.length === 0) {
          await db.collection(KEYWORDS_COLLECTION).doc(keyword.id).update({
            status: 'failed',
          });
          return { success: false, keyword: keyword.keyword, error: 'No hospitals found' };
        }

        // Use fallback results
        hospitals.push(...fallbackHospitals);
      }

      // Generate articles in all languages (dynamic import to avoid loading anthropic SDK on page renders)
      const { generateAllLanguageArticles } = await import('./generator');
      const articles = await generateAllLanguageArticles(keyword, hospitals);

      // Save all articles to Firestore
      const batch = db.batch();
      for (const article of articles) {
        const ref = db.collection(ARTICLES_COLLECTION).doc(article.id);
        // Don't store full hospitals array in every article (save space)
        const articleData = {
          ...article,
          hospitals: article.hospitals.map((h: { id: string; name: string; address: string; phone: string; businessHours: string; specialistsInfo: string; naverReviewCount: number; kakaoRating: number | null; kakaoReviewCount: number }) => ({
            id: h.id,
            name: h.name,
            address: h.address,
            phone: h.phone,
            businessHours: h.businessHours,
            specialistsInfo: h.specialistsInfo,
            naverReviewCount: h.naverReviewCount,
            kakaoRating: h.kakaoRating,
            kakaoReviewCount: h.kakaoReviewCount,
          })),
        };
        batch.set(ref, articleData);
      }

      // Mark keyword as published
      batch.update(db.collection(KEYWORDS_COLLECTION).doc(keyword.id), {
        status: 'published',
        publishedAt: new Date().toISOString(),
      });

      await batch.commit();

      console.log(`[Publish] Published ${articles.length} articles for "${keyword.keyword}"`);
      return {
        success: true,
        keyword: keyword.keyword,
        articlesCreated: articles.length,
      };
    } catch (error) {
      console.error(`[Publish] Failed for "${keyword.keyword}":`, error);
      await db.collection(KEYWORDS_COLLECTION).doc(keyword.id).update({
        status: 'failed',
      });
      return {
        success: false,
        keyword: keyword.keyword,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } catch (error) {
    console.error('[Publish] Fatal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Get published articles (no composite index needed) ---
export async function getArticles(lang: string, category?: string, limit = 20): Promise<Article[]> {
  let query: FirebaseFirestore.Query = db.collection(ARTICLES_COLLECTION)
    .where('lang', '==', lang);

  if (category) {
    query = query.where('category', '==', category);
  }

  const snapshot = await query.limit(limit * 2).get();
  const articles = snapshot.docs.map(doc => doc.data() as Article);

  // Sort in JS to avoid needing composite index
  articles.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return articles.slice(0, limit);
}

// --- Get single article ---
export async function getArticle(lang: string, category: string, slug: string): Promise<Article | null> {
  const id = `${category}-${slug}-${lang}`;
  const doc = await db.collection(ARTICLES_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as Article;
}

// --- Get all articles for sitemap ---
export async function getAllArticleSlugs(): Promise<{ lang: string; category: string; slug: string }[]> {
  const snapshot = await db.collection(ARTICLES_COLLECTION)
    .select('lang', 'category', 'slug')
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { lang: data.lang, category: data.category, slug: data.slug };
  });
}
