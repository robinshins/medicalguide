import Link from 'next/link';
import Image from 'next/image';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';
import { getArticles } from '@/lib/articles';

export const revalidate = 1800;

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];

  let dentalArticles: Awaited<ReturnType<typeof getArticles>> = [];
  let dermaArticles: Awaited<ReturnType<typeof getArticles>> = [];
  try {
    [dentalArticles, dermaArticles] = await Promise.all([
      getArticles(l, 'dental', 6),
      getArticles(l, 'dermatology', 6),
    ]);
  } catch {
    // Firestore may not be initialized yet
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';
  const jsonLdSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Medical Korea Guide',
      url: baseUrl,
      logo: `${baseUrl}/icon-192.png`,
      description: t.siteDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: t.siteName,
      url: `${baseUrl}/${l}`,
      inLanguage: l,
      description: t.siteDescription,
      publisher: { '@type': 'Organization', name: 'Medical Korea Guide' },
    },
  ];

  return (
    <div>
      {jsonLdSchemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      {/* Hero Section */}
      <section className="relative bg-gray-950 text-white overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute -top-20 -right-20 w-64 h-64 opacity-30">
          <Image src="/img/shape-1.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="absolute -bottom-16 -left-16 w-48 h-48 opacity-20">
          <Image src="/img/shape-5.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="absolute top-1/2 right-1/4 w-32 h-32 opacity-15">
          <Image src="/img/shape-3.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-blue-300 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              {t.trustBadge}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1] tracking-tight">
              {t.siteTagline}
            </h1>
            <p className="text-lg text-gray-300 max-w-xl mb-10 leading-relaxed">
              {t.siteDescription}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${l}/dental`}
                className="inline-flex items-center justify-center bg-white text-gray-900 px-7 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-100 transition-colors"
              >
                {t.dental}
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
              <Link
                href={`/${l}/dermatology`}
                className="inline-flex items-center justify-center bg-white/10 text-white px-7 py-3.5 rounded-xl font-semibold text-base hover:bg-white/20 transition-colors border border-white/10"
              >
                {t.dermatology}
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {l === 'ko' ? '신뢰할 수 있는 정보, 정확한 데이터' : 'Trusted Information, Accurate Data'}
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              {l === 'ko'
                ? '한국에서 가장 많이 사용되는 네이버와 카카오의 실제 리뷰 데이터, 그리고 공공기관 정보를 직접 분석합니다.'
                : 'We directly analyze real review data from Korea\'s most popular platforms — Naver and Kakao — along with official public health records.'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TrustCard
              image="/img/shape-4.png"
              title={l === 'ko' ? '실제 방문자 리뷰 분석' : 'Real Visitor Review Analysis'}
              description={l === 'ko'
                ? '네이버 플레이스와 카카오맵의 실제 방문자 리뷰를 수집하고 분석하여 가장 신뢰할 수 있는 정보를 제공합니다.'
                : 'We collect and analyze real visitor reviews from Naver Place and KakaoMap to provide the most reliable information.'}
            />
            <TrustCard
              image="/img/shape-6.png"
              title={l === 'ko' ? '건강보험심사평가원 공공데이터' : 'HIRA Official Public Data'}
              description={l === 'ko'
                ? '건강보험심사평가원(HIRA)의 공식 데이터를 활용하여 전문의 수, 진료과목, 특수장비 등 객관적인 정보를 확인합니다.'
                : 'We utilize official HIRA data to verify specialist counts, departments, and medical equipment objectively.'}
            />
            <TrustCard
              image="/img/shape-7.png"
              title={l === 'ko' ? '종합적 비교 분석' : 'Comprehensive Comparison'}
              description={l === 'ko'
                ? '리뷰, 평점, 전문의 정보, 시설, 접근성을 종합적으로 분석하여 최적의 병원을 추천합니다.'
                : 'We comprehensively analyze reviews, ratings, specialist info, facilities, and accessibility to recommend the best clinics.'}
            />
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            {l === 'ko' ? '병원 선정 프로세스' : 'Our Selection Process'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StepCard
              step="01"
              title={l === 'ko' ? '데이터 수집' : 'Data Collection'}
              description={l === 'ko'
                ? '네이버 플레이스, 카카오맵에서 실제 방문자 리뷰와 평점을 수집합니다.'
                : 'Collect real visitor reviews and ratings from Naver Place and KakaoMap.'}
            />
            <StepCard
              step="02"
              title={l === 'ko' ? '공공정보 검증' : 'Official Verification'}
              description={l === 'ko'
                ? '건강보험심사평가원에서 전문의 수, 진료과목, 특수장비 정보를 확인합니다.'
                : 'Verify specialist count, departments, and equipment through HIRA official data.'}
            />
            <StepCard
              step="03"
              title={l === 'ko' ? '종합 분석' : 'Analysis'}
              description={l === 'ko'
                ? '수집된 데이터를 종합적으로 분석하여 가장 신뢰할 수 있는 병원을 선별합니다.'
                : 'Comprehensively analyze all collected data to select the most trustworthy clinics.'}
            />
            <StepCard
              step="04"
              title={l === 'ko' ? '상세 리뷰 작성' : 'Detailed Review'}
              description={l === 'ko'
                ? '각 병원의 장단점, 실제 후기, 실용 정보를 상세하게 정리하여 제공합니다.'
                : 'Provide detailed pros/cons, real reviews, and practical information for each clinic.'}
            />
          </div>
        </div>
      </section>

      {/* Latest Dental Articles */}
      {dentalArticles.length > 0 && (
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t.dental} &mdash; {t.latestArticles}</h2>
              <Link href={`/${l}/dental`} className="text-blue-600 text-sm font-medium hover:underline">
                {t.viewAll} &rarr;
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {dentalArticles.map(article => (
                <ArticleCard key={article.id} article={article} lang={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Derma Articles */}
      {dermaArticles.length > 0 && (
        <section className="bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t.dermatology} &mdash; {t.latestArticles}</h2>
              <Link href={`/${l}/dermatology`} className="text-blue-600 text-sm font-medium hover:underline">
                {t.viewAll} &rarr;
              </Link>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {dermaArticles.map(article => (
                <ArticleCard key={article.id} article={article} lang={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="relative bg-gray-950 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 opacity-20">
          <Image src="/img/shape-2.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="absolute bottom-0 left-0 w-40 h-40 opacity-15">
          <Image src="/img/shape-8.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {l === 'ko'
              ? '정확한 정보로 최적의 병원을 찾으세요'
              : 'Find the Best Clinic with Accurate Information'}
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            {l === 'ko'
              ? '매일 새로운 병원 리뷰가 업데이트됩니다. 네이버, 카카오 실제 리뷰와 공공데이터를 기반으로 한 가장 신뢰할 수 있는 의료 가이드입니다.'
              : 'New clinic reviews are updated daily. The most trustworthy medical guide based on real Naver & Kakao reviews and official HIRA data.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/${l}/dental`}
              className="bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              {t.dental}
            </Link>
            <Link
              href={`/${l}/dermatology`}
              className="border border-white/20 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              {t.dermatology}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustCard({ image, title, description }: { image: string; title: string; description: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="w-16 h-16 mb-5 relative">
        <Image src={image} alt="" width={64} height={64} className="w-full h-full object-contain" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-950 text-white text-sm font-bold mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function ArticleCard({ article, lang }: { article: { id: string; slug: string; category: string; title: string; metaDescription: string; publishedAt: string }; lang: SupportedLang }) {
  const t = UI_TRANSLATIONS[lang];
  return (
    <Link
      href={`/${lang}/${article.category}/${article.slug}`}
      className="group bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-all"
    >
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 mb-2 line-clamp-2 transition-colors">
        {article.title}
      </h3>
      <p className="text-sm text-gray-500 line-clamp-3 mb-4 leading-relaxed">
        {article.metaDescription}
      </p>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{new Date(article.publishedAt).toLocaleDateString(LANG_CONFIG[lang].htmlLang)}</span>
        <span className="text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">{t.readMore} &rarr;</span>
      </div>
    </Link>
  );
}
