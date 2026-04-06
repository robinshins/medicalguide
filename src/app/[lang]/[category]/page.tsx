import Link from 'next/link';
import { getArticles } from '@/lib/articles';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';
import type { Metadata } from 'next';

const PER_PAGE = 100;

interface PageProps {
  params: Promise<{ lang: string; category: string }>;
  searchParams: Promise<{ page?: string }>;
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
  };
}

export const revalidate = 1800; // 30 minutes

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { lang, category } = await params;
  const { page: pageParam } = await searchParams;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const categoryName = category === 'dental' ? t.dental : t.dermatology;

  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  let allArticles: Awaited<ReturnType<typeof getArticles>> = [];
  try {
    allArticles = await getArticles(lang, category);
  } catch {
    // Firestore may not have data yet
  }

  const totalPages = Math.ceil(allArticles.length / PER_PAGE);
  const articles = allArticles.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href={`/${l}`} className="hover:text-blue-700">{t.backToHome}</Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{categoryName}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{categoryName}</h1>
      <p className="text-gray-600 mb-8">
        {t.siteDescription}
        {allArticles.length > 0 && (
          <span className="ml-2 text-sm text-gray-400">
            ({allArticles.length}{l === 'ko' ? '개 글' : ' articles'})
          </span>
        )}
      </p>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">
            {l === 'ko' ? '아직 발행된 글이 없습니다. 곧 업데이트됩니다.' : 'No articles published yet. Coming soon.'}
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
                  href={`/${l}/${category}${currentPage === 2 ? '' : `?page=${currentPage - 1}`}`}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                >
                  &larr; {l === 'ko' ? '이전' : 'Prev'}
                </Link>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Link
                  key={page}
                  href={`/${l}/${category}${page === 1 ? '' : `?page=${page}`}`}
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
                  href={`/${l}/${category}?page=${currentPage + 1}`}
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
