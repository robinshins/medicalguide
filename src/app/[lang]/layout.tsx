import type { Metadata } from 'next';
import { SUPPORTED_LANGUAGES, LANG_CONFIG, UI_TRANSLATIONS } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { GoogleAnalytics } from '@next/third-parties/google';
import LangDropdown from '@/app/components/LangDropdown';

export async function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map(lang => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const config = LANG_CONFIG[l];

  return {
    title: {
      default: `${t.siteName} — ${t.siteTagline}`,
      template: `%s | ${t.siteName}`,
    },
    description: t.siteDescription,
    openGraph: {
      title: `${t.siteName} — ${t.siteTagline}`,
      description: t.siteDescription,
      locale: config.htmlLang,
      type: 'website',
    },
    alternates: {
      languages: Object.fromEntries(
        SUPPORTED_LANGUAGES.map(sl => [LANG_CONFIG[sl].htmlLang, `/${sl}`])
      ),
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const t = UI_TRANSLATIONS[l];
  const config = LANG_CONFIG[l];

  return (
    <html lang={config.htmlLang} dir={config.direction} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <GoogleAnalytics gaId="G-VVC2XX5P0N" />
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href={`/${l}`} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 p-0.5 flex items-center justify-center">
                <Image src="/icon-192.png" alt="Medical Korea Guide" width={28} height={28} className="rounded-md" />
              </div>
              <span className="text-base font-bold text-gray-900 tracking-tight">{t.siteName}</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href={`/${l}/dental`} className="text-gray-500 hover:text-gray-900 font-medium transition-colors">
                {t.dental}
              </Link>
              <Link href={`/${l}/dermatology`} className="text-gray-500 hover:text-gray-900 font-medium transition-colors">
                {t.dermatology}
              </Link>
              <div className="relative group">
                <button className="text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                  {config.nativeName}
                </button>
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 hidden group-hover:block z-50 min-w-[140px]">
                  {SUPPORTED_LANGUAGES.map(sl => (
                    <Link
                      key={sl}
                      href={`/${sl}`}
                      className={`block px-3 py-1.5 text-xs transition-colors ${
                        sl === l ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {LANG_CONFIG[sl].nativeName}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-gray-950 text-gray-300">
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <Image src="/icon-192.png" alt="Medical Korea Guide" width={24} height={24} className="rounded-md" />
                  <span className="text-sm font-bold text-white">{t.siteName}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t.siteDescription}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Categories</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href={`/${l}/dental`} className="hover:text-white transition-colors">{t.dental}</Link></li>
                  <li><Link href={`/${l}/dermatology`} className="hover:text-white transition-colors">{t.dermatology}</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">{t.dataSource}</h4>
                <ul className="text-sm space-y-2 text-gray-500">
                  <li>Naver Place</li>
                  <li>KakaoMap</li>
                  <li>HIRA (Health Insurance Review & Assessment Service)</li>
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-white/5 text-center text-xs text-gray-600">
              &copy; {new Date().getFullYear()} Medical Korea Guide. Data sourced from public reviews and official health records.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
