import { DENTAL_PRICING_KO } from '@/lib/pricing-data';
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
    ? '한국 치과 시술 평균 가격 가이드 (2025~2026) | Medical Korea Guide'
    : `Korea Dental Treatment Price Guide (2025-2026) | ${t.siteName}`;
  const description = l === 'ko'
    ? '임플란트, 교정, 크라운, 충치치료, 신경치료 등 한국 치과 시술별 평균 가격을 건강보험심사평가원 공식 데이터 기반으로 정리했습니다.'
    : 'Average prices for dental treatments in Korea including implants, orthodontics, crowns, and more. Based on official HIRA data.';

  return {
    title,
    description,
    keywords: l === 'ko'
      ? '치과 가격, 임플란트 가격, 치아교정 가격, 크라운 가격, 한국 치과 비용, 치과 비급여'
      : 'Korea dental prices, implant cost Korea, orthodontics cost Korea, dental treatment prices',
    robots: { index: true, follow: true },
    openGraph: { title, description, type: 'article', locale: LANG_CONFIG[l].htmlLang, url: `${baseUrl}/${l}/dental/pricing`, images: [{ url: `${baseUrl}/og/og-dental.png`, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description },
    alternates: {
      canonical: `${baseUrl}/${l}/dental/pricing`,
      languages: {
        ...Object.fromEntries(SUPPORTED_LANGUAGES.map(sl => [LANG_CONFIG[sl].htmlLang, `${baseUrl}/${sl}/dental/pricing`])),
        'x-default': `${baseUrl}/en/dental/pricing`,
      },
    },
  };
}

export default async function DentalPricingPage({ params }: PageProps) {
  const { lang } = await params;
  const l = (SUPPORTED_LANGUAGES.includes(lang as SupportedLang) ? lang : 'ko') as SupportedLang;

  return <PricingPage data={DENTAL_PRICING_KO} lang={l} category="dental" />;
}
