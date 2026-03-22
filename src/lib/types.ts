export interface HospitalInfo {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  businessHours: string;
  specialistsInfo: string;
  facilities: string;
  naverReviewCount: number;
  naverBlogReviewCount: number;
  naverReviews: ReviewItem[];
  kakaoRating: number | null;
  kakaoReviewCount: number;
  kakaoReviews: ReviewItem[];
  googleRating: number | null;
  googleReviewCount: number;
  imageUrls: string[];
  homepage: string;
  blogUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  directions: string;
  naverStarRating: number | null;
}

export interface ReviewItem {
  author: string;
  content: string;
  date: string;
  visitCount?: string;
  source: 'naver' | 'kakao';
}

export interface KeywordEntry {
  id: string;
  keyword: string;
  region: string;
  regionSlug: string;
  specialty: string;
  specialtySlug: string;
  category: 'dental' | 'dermatology';
  status: 'pending' | 'in_progress' | 'published' | 'failed';
  publishedAt: string | null;
  order: number;
}

export interface Article {
  id: string;
  keywordId: string;
  keyword: string;
  lang: string;
  slug: string;
  category: 'dental' | 'dermatology';
  title: string;
  metaDescription: string;
  content: string;
  hospitals: HospitalInfo[];
  publishedAt: string;
  region: string;
  specialty: string;
}

export type SupportedLang =
  | 'ko' | 'en' | 'zh-TW' | 'zh-CN' | 'ja'
  | 'vi' | 'th' | 'ru' | 'es' | 'es-MX'
  | 'pt-BR' | 'de' | 'it';
