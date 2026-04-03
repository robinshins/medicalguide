import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getAllArticleSlugs } from '@/lib/articles';

export const revalidate = 3600;

export async function GET() {
  let baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.medicalguide.co.kr').trim();
  if (!/^https?:\/\//.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');
  const now = new Date().toISOString();

  const urls: string[] = [];

  // Home + category pages
  for (const lang of SUPPORTED_LANGUAGES) {
    urls.push(`<url><loc>${baseUrl}/${lang}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`);
    for (const cat of ['dental', 'dermatology']) {
      urls.push(`<url><loc>${baseUrl}/${lang}/${cat}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`);
      urls.push(`<url><loc>${baseUrl}/${lang}/${cat}/pricing</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
    }
  }

  // Articles from Firestore
  try {
    const articles = await getAllArticleSlugs();
    for (const a of articles) {
      urls.push(`<url><loc>${baseUrl}/${a.lang}/${a.category}/${a.slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }
  } catch {
    // Firestore unavailable
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
