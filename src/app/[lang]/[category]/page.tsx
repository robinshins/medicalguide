import Link from 'next/link';
import { getArticles, getArticleSummaries } from '@/lib/articles';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang, ArticleSummary } from '@/lib/types';
import type { Metadata } from 'next';
import SearchBox from '@/app/components/SearchBox';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';

const PER_PAGE = 100;

interface PageProps {
  params: Promise<{ lang: string; category: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}

export async function generateStaticParams() {
  const params: { lang: string; category: string }[] = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    params.push({ lang, category: 'dental' });
    params.push({ lang, category: 'dermatology' });
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, category } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const categoryName = category === 'dental' ? t.dental : t.dermatology;

  return {
    title: `${categoryName} - ${t.siteName}`,
    description: `${categoryName} ${t.siteDescription}`,
    alternates: {
      canonical: `${BASE_URL}/${lang}/${category}`,
      languages: {
        ...Object.fromEntries(
          SUPPORTED_LANGUAGES.map(sl => [LANG_CONFIG[sl].htmlLang, `${BASE_URL}/${sl}/${category}`])
        ),
        'x-default': `${BASE_URL}/en/${category}`,
      },
    },
  };
}

export const revalidate = 7200; // 2 hours

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { lang, category } = await params;
  const { page: pageParam, q: qParam } = await searchParams;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const categoryName = category === 'dental' ? t.dental : t.dermatology;

  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const query = (qParam || '').trim();
  const queryLower = query.toLowerCase();

  // Index holds latest 500 items (5 pages at 100/page). Use it for the common
  // case (browse page 1-5, no search). Fall back to full collection scan when
  // the user searches or paginates past the index cap — expensive but rare.
  const INDEX_PAGES = 5;
  const needsFullCollection = !!query || currentPage > INDEX_PAGES;

  let allArticles: ArticleSummary[] = [];
  try {
    if (needsFullCollection) {
      const full = await getArticles(lang, category);
      allArticles = full.map(a => ({
        id: a.id, slug: a.slug, category: a.category, lang: a.lang,
        title: a.title, metaDescription: a.metaDescription,
        publishedAt: a.publishedAt, region: a.region, specialty: a.specialty,
      }));
    } else {
      allArticles = await getArticleSummaries(lang, category);
    }
  } catch {
    // Firestore may not have data yet
  }

  const filteredArticles = query
    ? allArticles.filter(a =>
        a.title.toLowerCase().includes(queryLower) ||
        a.metaDescription.toLowerCase().includes(queryLower) ||
        a.slug.toLowerCase().includes(queryLower)
      )
    : allArticles;

  const totalPages = Math.ceil(filteredArticles.length / PER_PAGE);
  const articles = filteredArticles.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const pageQueryString = query ? `&q=${encodeURIComponent(query)}` : '';
  const firstPageSuffix = query ? `?q=${encodeURIComponent(query)}` : '';

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: `${categoryName} ${t.siteDescription}`,
    url: `${BASE_URL}/${l}/${category}`,
    inLanguage: l,
    isPartOf: { '@type': 'WebSite', name: 'Medical Korea Guide', url: BASE_URL },
    ...(allArticles.length > 0 ? {
      hasPart: allArticles.slice(0, 20).map(a => ({
        '@type': 'Article',
        headline: a.title,
        url: `${BASE_URL}/${l}/${category}/${a.slug}`,
      })),
    } : {}),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <nav className="text-sm text-gray-500 mb-6">
        <Link href={`/${l}`} className="hover:text-blue-700">{t.backToHome}</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{categoryName}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{categoryName}</h1>
      <p className="text-gray-600 mb-6">
        {t.siteDescription}
        {allArticles.length > 0 && (
          <span className="ml-2 text-sm text-gray-400">
            ({allArticles.length}{l === 'ko' ? '개 글' : ' articles'})
          </span>
        )}
      </p>

      <SearchBox
        lang={l}
        category={category}
        initialQuery={query}
        placeholder={t.searchPlaceholder}
        ariaLabel={t.searchButton}
      />

      {query && (
        <p className="text-sm text-gray-500 mb-4">
          {t.searchResultsFor}: <span className="font-medium text-gray-900">&ldquo;{query}&rdquo;</span>
          <span className="ml-2 text-gray-400">({filteredArticles.length})</span>
        </p>
      )}

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">
            {query
              ? t.noSearchResults
              : (l === 'ko' ? '아직 발행된 글이 없습니다. 곧 업데이트됩니다.' : 'No articles published yet. Coming soon.')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map(article => (
              <Link
                key={article.id}
                href={`/${l}/${category}/${article.slug}`}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <h2 className="font-bold text-gray-900 group-hover:text-blue-700 mb-2 line-clamp-2">
                  {article.title}
                </h2>
                <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                  {article.metaDescription}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{new Date(article.publishedAt).toLocaleDateString(LANG_CONFIG[l].htmlLang)}</span>
                  <span className="text-blue-600 font-medium">{t.readMore} &rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex justify-center items-center gap-2 mt-10">
              {currentPage > 1 && (
                <Link
                  href={`/${l}/${category}${currentPage === 2 ? firstPageSuffix : `?page=${currentPage - 1}${pageQueryString}`}`}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                >
                  &larr; {l === 'ko' ? '이전' : 'Prev'}
                </Link>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Link
                  key={page}
                  href={`/${l}/${category}${page === 1 ? firstPageSuffix : `?page=${page}${pageQueryString}`}`}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    page === currentPage
                      ? 'bg-blue-600 text-white font-bold'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </Link>
              ))}

              {currentPage < totalPages && (
                <Link
                  href={`/${l}/${category}?page=${currentPage + 1}${pageQueryString}`}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                >
                  {l === 'ko' ? '다음' : 'Next'} &rarr;
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
