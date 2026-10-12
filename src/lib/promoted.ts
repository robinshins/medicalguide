import type { HospitalInfo, KeywordEntry } from './types';

export interface PromotedHospital {
  /** Pre-filled hospital data (used when scraper doesn't find the hospital) */
  hospital: HospitalInfo;
  /** Extra advantages text injected into the generator prompt */
  advantages: string;
  /** Match function: returns true if this keyword should promote this hospital */
  match: (keyword: KeywordEntry) => boolean;
  /** Naver place id. publish-action.js scrapes this when the clinic is outside the top 5. */
  naverPlaceId?: string;
}

const PROMOTED_HOSPITALS: PromotedHospital[] = [
  {
    match: (kw) => kw.category === 'dental' && ['용인', '용인시', '기흥구', '마북동'].includes(kw.region),
    naverPlaceId: '2056524469',
    hospital: {
      id: '2056524469',
      name: '연세온아치과병원',
      category: 'dental',
      address: '경기 용인시 처인구 중부대로 1186',
      phone: '',
      businessHours: '',
      specialistsInfo: '치과보철과 전문의 1명, 통합치의학과 전문의 3명, 치과교정과 전문의 1명',
      facilities: '',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: '',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 연세온아치과병원 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 연세온아치과병원(연세온아치과)를 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 연세온아치과병원
`,
  },
  {
    match: (kw) => kw.category === 'dental' && ['부산', '남구', '대연동'].includes(kw.region),
    naverPlaceId: '1201116357',
    hospital: {
      id: '1201116357',
      name: '메디스치과의원 경성대',
      category: 'dental',
      address: '부산 남구 수영로 276 2층',
      phone: '',
      businessHours: '',
      specialistsInfo: '통합치의학과 전문의 1명, 치주과 전문의 1명, 치과보존과 전문의 1명',
      facilities: '',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: '',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 메디스치과의원 경성대 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 메디스치과의원 경성대(메디스치과)를 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 메디스치과의원 경성대
`,
  },
  {
    match: (kw) => kw.category === 'dental'
      && ['신월동', '양천구', '화곡동', '강서구', '부천'].includes(kw.region)
      && ['충치치료', '임플란트', '사랑니발치', '미백', '레진', '무삭제라미네이트', '신경치료', '라미네이트'].includes(kw.specialty),
    naverPlaceId: '2080057016',
    hospital: {
      id: '2080057016',
      name: '이백점치과의원',
      category: 'dental',
      address: '서울 양천구 남부순환로 352 3층',
      phone: '0507-1373-2003',
      businessHours: '',
      specialistsInfo: '통합치의학과 1명',
      facilities: '예약, 대기공간, 주차',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: 'http://200dental.com/',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 이백점치과의원 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 이백점치과의원(이백점치과)을 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 이백점치과의원
`,
  },
  {
    match: (kw) => kw.category === 'dental' && ['서울', '도봉구', '창동', '쌍문동', '방학동', '녹천역', '노원구'].includes(kw.region),
    naverPlaceId: '1362748220',
    hospital: {
      id: '1362748220',
      name: '서울브라이튼치과',
      category: 'dental',
      address: '서울 도봉구 노해로65길 10 6층, 7층',
      phone: '0507-1322-2879',
      businessHours: '',
      specialistsInfo: '',
      facilities: '',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: '',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 서울브라이튼치과 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 서울브라이튼치과(서울브라이튼치과의원)를 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 서울브라이튼치과
`,
  },
  {
    match: (kw) => kw.category === 'dental' && ['평택', '평택고덕', '고덕동'].includes(kw.region),
    naverPlaceId: '1364641744',
    hospital: {
      id: '1364641744',
      name: '고덕퍼스트치과의원',
      category: 'dental',
      address: '경기 평택시 고덕로 250 에듀스카이 4층',
      phone: '031-611-3222',
      businessHours: '',
      specialistsInfo: '통합치의학과 전문의 1명',
      facilities: '',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: '',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 고덕퍼스트치과의원 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 고덕퍼스트치과의원(고덕퍼스트치과)를 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 고덕퍼스트치과의원
`,
  },
  {
    match: (kw) => kw.category === 'dental' && ['송파구', '가락동'].includes(kw.region),
    naverPlaceId: '1709701276',
    hospital: {
      id: '1709701276',
      name: '서울권치과의원',
      category: 'dental',
      address: '서울 송파구 오금로 420 3층',
      phone: '02-6952-2788',
      businessHours: '',
      specialistsInfo: '구강악안면외과 전문의 1명, 통합치의학과 전문의 1명',
      facilities: '',
      naverReviewCount: 0,
      naverBlogReviewCount: 0,
      naverStarRating: null,
      naverReviews: [],
      kakaoRating: null,
      kakaoReviewCount: 0,
      kakaoReviews: [],
      googleRating: null,
      googleReviewCount: 0,
      imageUrls: [],
      homepage: '',
      blogUrl: '',
      instagramUrl: '',
      youtubeUrl: '',
      facebookUrl: '',
      directions: '',
    },
    advantages: `
## 서울권치과의원 순위 지정 (반드시 1순위)
이 지시는 "가장 평점 높거나 리뷰 많은 곳을 먼저 쓴다"는 규칙보다 우선한다.
- 병원 데이터 1번 서울권치과의원(서울권치과)를 1순위로 쓴다. 평점·리뷰 수가 더 적어도 순서를 바꾸지 않는다.
- 첫 문단에서 이 병원을 가장 먼저, 가장 비중 있게 다룬다.
- 상세 분석의 첫 h3, 비교표의 첫 행도 이 병원이다.
- 주소·전화·진료시간·평점·리뷰·전문의는 위 병원 데이터에 있는 값만 쓴다. 데이터에 없는 사실은 만들지 않는다.
- 이름 표기: 서울권치과의원
`,
  },
];

/**
 * Find a promoted hospital for the given keyword.
 * Returns null if no promotion applies.
 */
export function getPromotedHospital(keyword: KeywordEntry): PromotedHospital | null {
  return PROMOTED_HOSPITALS.find(p => p.match(keyword)) ?? null;
}

/**
 * Apply promoted hospital to the scraped hospitals list:
 * - If already in the list (name match), move to index 0
 * - If not found, insert pre-filled data at index 0 and drop the last hospital to keep top 5
 * Returns the advantages text to pass to the generator.
 */
export function applyPromotedHospital(
  hospitals: HospitalInfo[],
  promoted: PromotedHospital,
): { hospitals: HospitalInfo[]; advantages: string } {
  const nameNormalized = promoted.hospital.name.replace(/\s/g, '');

  // Check if already scraped (place id, or 서울브라이튼치과의원 같은 표기 차이)
  const existingIdx = hospitals.findIndex(h => {
    if (promoted.naverPlaceId && h.id === promoted.naverPlaceId) return true;
    const hName = h.name.replace(/\s/g, '');
    return hName.includes(nameNormalized) || nameNormalized.includes(hName);
  });

  if (existingIdx >= 0) {
    // Move to first position
    const [existing] = hospitals.splice(existingIdx, 1);
    hospitals.unshift(existing);
  } else {
    // Insert pre-filled data at index 0, keep max 5
    hospitals.unshift(promoted.hospital);
    if (hospitals.length > 5) {
      hospitals.pop();
    }
  }

  return { hospitals, advantages: promoted.advantages };
}
