import Link from 'next/link';
import { getArticles } from '@/lib/articles';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ lang: string; category: string }>;
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

export default async function CategoryPage({ params }: PageProps) {
  const { lang, category } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const categoryName = category === 'dental' ? t.dental : t.dermatology;

  let articles: Awaited<ReturnType<typeof getArticles>> = [];
  try {
    articles = await getArticles(lang, category, 50);
  } catch {
    // Firestore may not have data yet
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href={`/${l}`} className="hover:text-blue-700">{t.backToHome}</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">{categoryName}</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{categoryName}</h1>
      <p className="text-gray-600 mb-8">{t.siteDescription}</p>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">
            {l === 'ko' ? '아직 발행된 글이 없습니다. 곧 업데이트됩니다.' : 'No articles published yet. Coming soon.'}
          </p>
        </div>
      ) : (
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
                <span className="text-blue-600 font-medium">{t.readMore} →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
