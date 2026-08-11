import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getAllArticleSlugsFromIndex } from '@/lib/articles';

export const revalidate = 86400; // 24h — crawlers re-fetch slowly, full scan is expensive

export async function GET() {
  let baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.medicalguide.co.kr').trim();
  if (!/^https?:\/\//.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/+$/, '');
  // 홈·카테고리처럼 계속 바뀌는 페이지에만 쓴다. 글에는 실제 발행일을 쓴다.
  const now = new Date().toISOString();

  // <lastmod>는 그 URL이 마지막으로 바뀐 시점이어야 한다. 모든 글에 현재 시각을
  // 찍으면 크롤러는 매번 전체가 갱신된 것으로 보고, 결국 이 신호를 무시한다.
  // (실제로 이 사이트는 9,457개 URL 전부가 "오늘 수정됨"으로 나가고 있었다.)
  const lastmodOf = (publishedAt?: string) => {
    if (!publishedAt) return now;
    const d = new Date(publishedAt);
    return Number.isNaN(d.getTime()) ? now : d.toISOString();
  };

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
    const articles = await getAllArticleSlugsFromIndex();
    for (const a of articles) {
      urls.push(`<url><loc>${baseUrl}/${a.lang}/${a.category}/${a.slug}</loc><lastmod>${lastmodOf(a.publishedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
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
