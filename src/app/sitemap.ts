import type { MetadataRoute } from 'next';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getAllArticleSlugs } from '@/lib/articles';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';
  const entries: MetadataRoute.Sitemap = [];

  // Home pages for each language
  for (const lang of SUPPORTED_LANGUAGES) {
    entries.push({
      url: `${baseUrl}/${lang}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    });

    // Category pages
    for (const category of ['dental', 'dermatology']) {
      entries.push({
        url: `${baseUrl}/${lang}/${category}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      });
    }
  }

  // Article pages from Firestore
  try {
    const articles = await getAllArticleSlugs();
    for (const article of articles) {
      entries.push({
        url: `${baseUrl}/${article.lang}/${article.category}/${article.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Firestore may not be available during build
  }

  return entries;
}
