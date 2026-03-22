import type { MetadataRoute } from 'next';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

// Note: Dynamic articles will be added via getAllArticleSlugs() once Firestore has data
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalkoreaguide.com';
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

  return entries;
}
