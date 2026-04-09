import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getArticle } from '@/lib/articles';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang, HospitalInfo } from '@/lib/types';
import type { Metadata } from 'next';
import Comments from '@/app/components/Comments';

interface PageProps {
  params: Promise<{ lang: string; category: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, category, slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';
  let article: Awaited<ReturnType<typeof getArticle>> = null;
  try { article = await getArticle(lang, category, slug); } catch { /* */ }
  if (!article) return { title: 'Not Found' };
  const langConfig = LANG_CONFIG[lang as SupportedLang] || LANG_CONFIG.ko;
  const canonicalUrl = `${baseUrl}/${lang}/${category}/${slug}`;
  const ogImage = `${baseUrl}/og/${category === 'dental' ? 'og-dental.png' : 'og-derma.png'}`;
  const categoryKo = category === 'dental' ? '치과' : '피부과';
  const hospitalCount = article.hospitals?.length || 0;

  return {
    title: article.title,
    description: article.metaDescription,
    keywords: `${article.region} ${categoryKo}, ${article.region} ${categoryKo} 추천, ${article.keyword}, ${article.region} ${categoryKo} 잘하는곳, ${article.region} ${categoryKo} 후기`,
    authors: [{ name: 'Medical Korea Guide', url: baseUrl }],
    robots: { index: true, follow: true },
    openGraph: {
      title: `${article.title} | Medical Korea Guide`,
      description: article.metaDescription,
      type: 'article',
      locale: langConfig.htmlLang,
      publishedTime: article.publishedAt,
      siteName: 'Medical Korea Guide',
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.metaDescription,
      images: [ogImage],
      site: '@MedicalKoreaGuide',
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LANGUAGES.map(sl => [LANG_CONFIG[sl].htmlLang, `${baseUrl}/${sl}/${category}/${slug}`])
        ),
        'x-default': `${baseUrl}/en/${category}/${slug}`,
      },
    },
    other: {
      'article:author': 'Medical Korea Guide',
      'article:section': categoryKo,
      'article:tag': `${article.region},${categoryKo},${article.specialty || ''},병원추천,리뷰`,
      'hospital:count': String(hospitalCount),
    },
  };
}

export const dynamicParams = true;
export const revalidate = 3600;

function stripEmojis(html: string): string {
  return html.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1FFFF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]|[⭐📍📞🏥🕐🏅📋✅❌⚡🔍💡🦷✨🔬💉🏆👨‍⚕️👩‍⚕️📌📎🗓️⏰🅿️]/gu, '');
}

function buildJsonLd(article: NonNullable<Awaited<ReturnType<typeof getArticle>>>, lang: string, category: string, slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';
  const pageUrl = `${baseUrl}/${lang}/${category}/${slug}`;
  const categoryName = category === 'dental' ? '치과' : '피부과';
  const ogImage = `${baseUrl}/og/${category === 'dental' ? 'og-dental.png' : 'og-derma.png'}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemas: any[] = [];

  // 1. Article schema
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { '@type': 'Organization', name: 'Medical Korea Guide', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'Medical Korea Guide', url: baseUrl, logo: { '@type': 'ImageObject', url: `${baseUrl}/icon-192.png` } },
    mainEntityOfPage: pageUrl,
    inLanguage: lang,
    image: ogImage,
  });

  // 2. BreadcrumbList (나만의닥터 패턴)
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, item: { '@id': baseUrl, name: 'Medical Korea Guide' } },
      { '@type': 'ListItem', position: 2, item: { '@id': `${baseUrl}/${lang}/${category}`, name: categoryName } },
      { '@type': 'ListItem', position: 3, item: { '@id': pageUrl, name: `${article.region} ${categoryName}` } },
    ],
  });

  // 3. ItemList with proper ListItem wrapping
  const hospitals = article.hospitals || [];
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    description: lang === 'ko'
      ? `${article.region} ${categoryName} ${hospitals.length}개 비교 정보`
      : `Comparison of ${hospitals.length} ${categoryName} clinics in ${article.region}`,
    numberOfItems: hospitals.length,
    itemListElement: hospitals.map((h: HospitalInfo, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: h.name,
      ...(h.id ? { url: `https://m.place.naver.com/place/${h.id}` } : {}),
      image: `${baseUrl}/og/rank-${i + 1}.png`,
    })),
  });

  // 4. LocalBusiness per hospital (나만의닥터 패턴 — 각 병원 개별 스키마)
  hospitals.forEach((h: HospitalInfo) => {
    const addressParts = (h.address || '').split(' ');
    const region = addressParts[0] || '';
    const city = addressParts[1] || '';
    const street = addressParts.slice(2).join(' ');

    const hospitalUrl = h.id ? `https://m.place.naver.com/place/${h.id}` : (h.homepage || null);
    schemas.push({
      '@context': 'https://schema.org',
      '@type': category === 'dental' ? 'Dentist' : 'MedicalClinic',
      name: h.name,
      ...(hospitalUrl ? { url: hospitalUrl } : {}),
      ...(h.phone ? { telephone: h.phone } : {}),
      address: {
        '@type': 'PostalAddress',
        streetAddress: street,
        addressLocality: city,
        addressRegion: region,
        addressCountry: 'KR',
      },
      ...(h.kakaoRating || h.googleRating ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: h.kakaoRating || h.googleRating,
          reviewCount: (h.kakaoReviewCount || 0) + (h.naverReviewCount || 0) + (h.googleReviewCount || 0),
          bestRating: 5,
        },
      } : {}),
      image: ogImage,
    });
  });

  // 5. FAQPage
  const faqItems = article.content.match(/<h3[^>]*>([^<]*\?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g);
  const faqEntries = faqItems?.map(item => {
    const qMatch = item.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const aMatch = item.match(/<p>([\s\S]*?)<\/p>/);
    if (qMatch && aMatch) return { '@type': 'Question', name: qMatch[1], acceptedAnswer: { '@type': 'Answer', text: aMatch[1] } };
    return null;
  }).filter(Boolean) || [];

  if (faqEntries.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntries,
    });
  }

  return schemas;
}

export default async function ArticlePage({ params }: PageProps) {
  const { lang, category, slug } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];

  let article: Awaited<ReturnType<typeof getArticle>> = null;
  try { article = await getArticle(lang, category, slug); } catch { /* */ }
  if (!article) notFound();

  const publishDate = new Date(article.publishedAt).toLocaleDateString(
    LANG_CONFIG[l].htmlLang, { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const cleanContent = stripEmojis(article.content);
  const jsonLdSchemas = buildJsonLd(article, lang, category, slug);

  return (
    <div className="bg-white">
      {/* JSON-LD Structured Data */}
      {jsonLdSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      {/* Header */}
      <div className="relative bg-gray-950 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-15">
          <Image src="/img/shape-5.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="absolute bottom-0 left-10 w-32 h-32 opacity-10">
          <Image src="/img/shape-12.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-12">
          <nav className="text-sm text-gray-300 mb-5 flex items-center gap-2">
            <Link href={`/${l}`} className="hover:text-white transition-colors">{t.backToHome}</Link>
            <span className="text-gray-500">/</span>
            <Link href={`/${l}/${category}`} className="hover:text-white transition-colors">
              {category === 'dental' ? t.dental : t.dermatology}
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-white">{article.region}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4 tracking-tight">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <time dateTime={article.publishedAt} className="text-gray-300">{publishDate}</time>
            <span className="bg-white/10 text-blue-300 px-3 py-1 rounded-full text-xs font-medium border border-white/10">
              {t.trustBadge}
            </span>
            <span className="text-gray-400 text-xs">
              {l === 'ko' ? '의료정보 전문 에디터 감수' : 'Reviewed by Medical Information Editor'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Article content */}
        <article className="article-content" dangerouslySetInnerHTML={{ __html: cleanContent }} />

        {/* Hospital cards */}
        {article.hospitals && article.hospitals.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 relative shrink-0">
                <Image src="/img/shape-9.png" alt="" width={64} height={64} className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t.topHospitals}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6 ml-[52px]">
              {l === 'ko' ? '네이버 플레이스, 카카오맵, 구글맵 데이터 기준' : 'Based on Naver Place, KakaoMap, and Google Maps data'}
            </p>
            <div className="grid gap-4">
              {article.hospitals.map((hospital: HospitalInfo, i: number) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-all">
                  {/* Hospital image */}
                  {hospital.imageUrls && hospital.imageUrls.length > 0 && (
                    <div className="mb-4 rounded-xl overflow-hidden bg-gray-100">
                      <img src={`/api/img?url=${encodeURIComponent(hospital.imageUrls[0])}`} alt={hospital.name} className="w-full h-auto rounded-xl" loading="lazy" />
                    </div>
                  )}

                  {/* Name + Ratings */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-950 text-white text-xs font-bold shrink-0">{i + 1}</span>
                        <h3 className="font-bold text-lg text-gray-900">{hospital.name}</h3>
                      </div>
                      <p className="text-sm text-gray-500 ml-10">{hospital.address}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {hospital.naverStarRating && (
                        <div className="text-center bg-green-50 rounded-xl px-2.5 py-1.5">
                          <div className="text-lg font-bold text-green-700">{hospital.naverStarRating}</div>
                          <div className="text-[9px] text-green-600 font-medium">Naver</div>
                        </div>
                      )}
                      {hospital.kakaoRating && (
                        <div className="text-center bg-amber-50 rounded-xl px-2.5 py-1.5">
                          <div className="text-lg font-bold text-amber-600">{hospital.kakaoRating}</div>
                          <div className="text-[9px] text-amber-500 font-medium">Kakao</div>
                        </div>
                      )}
                      {hospital.googleRating && (
                        <div className="text-center bg-blue-50 rounded-xl px-2.5 py-1.5">
                          <div className="text-lg font-bold text-blue-600">{hospital.googleRating}</div>
                          <div className="text-[9px] text-blue-500 font-medium">Google</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info badges */}
                  <div className="mt-4 ml-10 flex flex-wrap gap-2 text-xs">
                    {hospital.phone && <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg">{hospital.phone}</span>}
                    {hospital.businessHours && <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg">{hospital.businessHours}</span>}
                    {hospital.naverReviewCount > 0 && <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium">Naver {hospital.naverReviewCount.toLocaleString()}</span>}
                    {hospital.kakaoReviewCount > 0 && <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-medium">Kakao {hospital.kakaoReviewCount.toLocaleString()}</span>}
                    {hospital.googleReviewCount > 0 && <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium">Google {hospital.googleReviewCount.toLocaleString()}</span>}
                  </div>

                  {/* Specialist info */}
                  {hospital.specialistsInfo && (
                    <div className="mt-3 ml-10 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 inline-block font-medium">
                      {hospital.specialistsInfo}
                    </div>
                  )}

                  {/* Map + Social links */}
                  <div className="mt-4 ml-10 flex flex-wrap gap-2">
                    {hospital.id && (
                      <a href={`https://m.place.naver.com/place/${hospital.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                        <MapIcon /> Naver Place
                      </a>
                    )}
                    <a href={`https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(hospital.name)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">
                      <MapIcon /> KakaoMap
                    </a>
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(hospital.name + ' ' + hospital.address)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                      <MapIcon /> Google Maps
                    </a>
                    {hospital.homepage && (
                      <a href={hospital.homepage} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                        <LinkIcon /> {l === 'ko' ? '홈페이지' : 'Website'}
                      </a>
                    )}
                    {hospital.blogUrl && (
                      <a href={hospital.blogUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                        <LinkIcon /> {l === 'ko' ? '블로그' : 'Blog'}
                      </a>
                    )}
                    {hospital.instagramUrl && (
                      <a href={hospital.instagramUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-700 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg transition-colors">
                        <LinkIcon /> Instagram
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Data source */}
        <div className="mt-14 bg-gray-50 rounded-2xl p-6 border border-gray-100 flex gap-4">
          <div className="w-12 h-12 shrink-0 relative">
            <Image src="/img/shape-18.png" alt="" width={64} height={64} className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{t.dataSource}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {l === 'ko'
                ? '본 글의 병원 정보, 리뷰, 전문의 정보는 네이버 플레이스, 카카오맵, 구글맵, 건강보험심사평가원의 공개 데이터를 기반으로 작성되었습니다. 실제 방문 전 해당 병원에 직접 확인하시기 바랍니다.'
                : 'Hospital information, reviews, and specialist data in this article are based on publicly available data from Naver Place, KakaoMap, Google Maps, and HIRA. Please verify directly with the clinic before visiting.'}
            </p>
          </div>
        </div>

        {/* Pricing guide link */}
        <Link
          href={`/${l}/${category}/pricing`}
          className="mt-8 flex items-center justify-between bg-gray-950 text-white rounded-2xl p-6 hover:bg-gray-900 transition-colors group"
        >
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {l === 'ko' ? '참고 가이드' : 'Reference Guide'}
            </p>
            <p className="font-bold text-lg">
              {l === 'ko'
                ? `한국 ${category === 'dental' ? '치과' : '피부과'} 시술 평균 가격 가이드`
                : `Korea ${category === 'dental' ? 'Dental' : 'Dermatology'} Treatment Price Guide`}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {l === 'ko'
                ? '건강보험심사평가원 공식 데이터 기반 시술별 평균 가격 비교'
                : 'Compare average prices by treatment based on official HIRA data'}
            </p>
          </div>
          <svg className="w-6 h-6 text-gray-400 group-hover:translate-x-1 transition-transform shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Comments */}
        <Comments articleId={article.id} lang={l} />

        {/* Language selector */}
        <div className="mt-8 flex flex-wrap gap-1.5">
          {SUPPORTED_LANGUAGES.map(sl => (
            <Link key={sl} href={`/${sl}/${category}/${slug}`}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                sl === l ? 'bg-gray-950 text-white border-gray-950' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
              }`}>
              {LANG_CONFIG[sl].nativeName}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
}

function LinkIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
