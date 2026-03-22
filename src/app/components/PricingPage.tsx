import Link from 'next/link';
import Image from 'next/image';
import { UI_TRANSLATIONS, LANG_CONFIG, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';

interface PricingItem {
  name: string;
  insurance: string;
  priceRange: string;
  average: string;
  note?: string;
}

interface PricingSection {
  title: string;
  description?: string;
  items: PricingItem[];
  footnote?: string;
}

interface PricingData {
  title: string;
  subtitle: string;
  intro: string;
  lastUpdated: string;
  sections: PricingSection[];
  factors: string[];
  sources: string[];
}

export default function PricingPage({ data, lang, category }: { data: PricingData; lang: SupportedLang; category: 'dental' | 'dermatology' }) {
  const t = UI_TRANSLATIONS[lang];
  const categoryName = category === 'dental' ? t.dental : t.dermatology;

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="relative bg-gray-950 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 opacity-15">
          <Image src="/img/shape-5.png" alt="" width={400} height={400} className="w-full h-full object-contain" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-12">
          <nav className="text-sm text-gray-300 mb-5 flex items-center gap-2">
            <Link href={`/${lang}`} className="hover:text-white transition-colors">{t.backToHome}</Link>
            <span className="text-gray-500">/</span>
            <Link href={`/${lang}/${category}`} className="hover:text-white transition-colors">{categoryName}</Link>
            <span className="text-gray-500">/</span>
            <span className="text-white">{lang === 'ko' ? '가격 가이드' : 'Price Guide'}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4 tracking-tight">
            {data.title}
          </h1>
          <p className="text-gray-300 text-sm mb-3">{data.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="bg-white/10 text-blue-300 px-3 py-1 rounded-full text-xs font-medium border border-white/10">
              {t.trustBadge}
            </span>
            <span className="text-gray-400 text-xs">
              {lang === 'ko' ? `최종 업데이트: ${data.lastUpdated}` : `Last updated: ${data.lastUpdated}`}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Intro */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-10">
          <p className="text-sm text-blue-900 leading-relaxed">{data.intro}</p>
        </div>

        {/* Sections */}
        {data.sections.map((section, si) => (
          <section key={si} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 pb-3 border-b-2 border-gray-900 tracking-tight">
              {si + 1}. {section.title}
            </h2>
            {section.description && (
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{section.description}</p>
            )}

            {/* Price table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-950 text-white">
                    <th className="text-left p-3.5 text-xs font-semibold uppercase tracking-wider">
                      {lang === 'ko' ? '시술 항목' : 'Treatment'}
                    </th>
                    <th className="text-left p-3.5 text-xs font-semibold uppercase tracking-wider">
                      {lang === 'ko' ? '보험' : 'Insurance'}
                    </th>
                    <th className="text-left p-3.5 text-xs font-semibold uppercase tracking-wider">
                      {lang === 'ko' ? '가격 범위' : 'Price Range'}
                    </th>
                    <th className="text-left p-3.5 text-xs font-semibold uppercase tracking-wider">
                      {lang === 'ko' ? '평균' : 'Average'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, ii) => (
                    <tr key={ii} className={`${ii % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="p-3.5 text-sm text-gray-900 font-medium">
                        {item.name}
                        {item.note && <span className="block text-xs text-gray-400 mt-0.5">{item.note}</span>}
                      </td>
                      <td className="p-3.5 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          item.insurance === '급여' ? 'bg-green-100 text-green-700' :
                          item.insurance === '혼합' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.insurance}
                        </span>
                      </td>
                      <td className="p-3.5 text-sm text-gray-700">{item.priceRange}</td>
                      <td className="p-3.5 text-sm text-gray-900 font-semibold">{item.average}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {section.footnote && (
              <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2 border border-gray-100">
                {section.footnote}
              </p>
            )}
          </section>
        ))}

        {/* Price factors */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-gray-900 tracking-tight">
            {lang === 'ko' ? '가격에 영향을 미치는 주요 요소' : 'Key Factors Affecting Prices'}
          </h2>
          <div className="grid gap-3">
            {data.factors.map((factor, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-950 text-white text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{factor}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sources */}
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-10">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.dataSource}</h3>
          <ul className="space-y-1.5">
            {data.sources.map((source, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">-</span>
                {source}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            {lang === 'ko'
              ? '비급여 가격은 병원마다 차이가 있으므로 실제 치료 전 반드시 해당 병원에서 확인이 필요합니다.'
              : 'Non-covered procedure prices vary by clinic. Please confirm with the clinic before treatment.'}
          </p>
        </div>

        {/* Language selector */}
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED_LANGUAGES.map(sl => (
            <Link key={sl} href={`/${sl}/${category}/pricing`}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                sl === lang ? 'bg-gray-950 text-white border-gray-950' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}>
              {LANG_CONFIG[sl].nativeName}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
