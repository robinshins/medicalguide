import { DERMA_PRICING_KO } from '@/lib/pricing-data';
import PricingPage from '@/app/components/PricingPage';
import { SUPPORTED_LANGUAGES, LANG_CONFIG, UI_TRANSLATIONS } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map(lang => ({ lang }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://medicalguide.co.kr';
  const t = UI_TRANSLATIONS[l];

  const title = l === 'ko'
    ? '피부과 시술 평균 가격 총정리 (2026년 기준) | Medical Korea Guide'
    : `Korea Dermatology Treatment Price Guide (2026) | ${t.siteName}`;
  const description = l === 'ko'
    ? '보톡스, 필러, 레이저, 울쎄라, 써마지, 리프팅, 여드름 치료, 제모 등 한국 피부과 시술별 평균 가격을 모두닥 실거래가 기반으로 정리했습니다.'
    : 'Average prices for dermatology treatments in Korea including Botox, fillers, laser, Ulthera, Thermage, and more. Based on real transaction data.';

  return {
    title,
    description,
    keywords: l === 'ko'
      ? '피부과 가격, 보톡스 가격, 필러 가격, 울쎄라 가격, 써마지 가격, 레이저 가격, 한국 피부과 비용'
      : 'Korea dermatology prices, Botox cost Korea, filler cost Korea, Ulthera Thermage price',
    robots: { index: true, follow: true },
    openGraph: { title, description, type: 'article', locale: LANG_CONFIG[l].htmlLang, url: `${baseUrl}/${l}/dermatology/pricing`, images: [{ url: `${baseUrl}/og/og-derma.png`, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `${baseUrl}/${l}/dermatology/pricing`,
      languages: Object.fromEntries(SUPPORTED_LANGUAGES.map(sl => [LANG_CONFIG[sl].htmlLang, `${baseUrl}/${sl}/dermatology/pricing`])),
    },
  };
}

export default async function DermaPricingPage({ params }: PageProps) {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;

  return <PricingPage data={DERMA_PRICING_KO} lang={l} category="dermatology" />;
}
