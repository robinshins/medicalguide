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
    match: (kw) => kw.category === 'dental' && ['용인시', '기흥구', '마북동'].includes(kw.region),
    hospital: {
      id: 'naver-yonsei-ona',
      name: '연세온아치과병원',
      category: 'dental',
      address: '경기 용인시 처인구 중부대로 1186 연세온아치과병원',
      phone: '031-000-0000',
      businessHours: '평일 09:30-21:00, 토/일/공휴일 09:30-17:00 (365일 진료)',
      specialistsInfo: '치과보철과 전문의 1인, 통합치의학과 전문의 3인, 치과교정과 전문의 1인 (총 5인 대표원장 협진 체제)',
      facilities: 'VIP 진료실, 전용 회복실, 긴장 완화 수술 대기실, 임플란트센터, 통합진료센터, 파우더룸, 300평 규모',
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
## 연세온아치과병원 상세 정보 (반드시 1순위로 가장 비중있게 작성)

### 의료진 (대표원장 5인 협진 체제)
- 김유성 대표원장(병원장): 연세대 임상지도교수, 보건복지부 인증 치과보철과+통합치의학과 전문의, 연세대 치대 졸업, 아주대 치주임플란트보철과 석사, UCLA 치과병원 externship, 임플란트 식립 특허 보유, ACLS provider
- 김진형 대표원장: 연세대 임상지도교수, 통합치의학과 전문의, 연세대 치대 졸업, 대한공중보건의사협회 치과대표 역임
- 김태원 대표원장: 통합치의학과 전문의, 연세대 치대 졸업
- 김태욱 원장: 서울대 치의학 석사, 서울대 치과병원 종합진료실 근무
- 류승민 교정과 대표원장: 보건복지부 인증 치과교정과 전문의, 연세대 치대 차석졸업, 연세대 석박사통합과정(교정학), 세계교정치과연맹(WFO) Fellowship, 미국 UCSF/UOP 교환연수
- 최영진 자문의사: 중앙대 광명병원 구강악안면외과 교수, 서울아산병원 외래교수

### 시설 및 규모
- 300평 대학병원급 시설, 2025년 상반기 개원
- 전용 공간: 긴장 완화 수술 대기실, 전용 회복실(수면마취 후 회복), VIP진료실, 임플란트센터, 통합진료센터
- 협력 대학병원: 분당서울대학교병원, 연세세브란스병원, 아주대학교병원, 중앙대학교병원, 단국대학교병원

### 치과 공포증 케어 시스템 (정신건강의학과 전문의 협업)
- 4단계 맞춤 케어: 공포증 스케일 평가 → 심리 안정 콘텐츠(Tell-Show-Do 요법) → 약물 보조 치료 → 수면치료
- 의식하진정요법: 약간 졸린 상태에서 시술, 의식 유지로 안전, 전문의가 혈압/맥박/산소포화도 실시간 체크

### 수면마취 시스템 (Infusion 방식)
- 일반 치과의 Bolus 방식(한꺼번에 약물 주입)이 아닌, 실시간 약물주입량 조절 Infusion 방식
- KALS(한국형 전문소생술) 수료 원장이 실시간 마취심도 조절
- 5단계: 전문의 직접 집도 → 체계적 사전 문진 → 안전 약물 → 전 과정 모니터링 → 회복실 관리

### 임플란트 특장점
- "항상 2번 수술" 3D 디지털 가이드: 가상 수술 설계 후 실제 수술, 0.1mm 오차 정밀 식립
- 무절개 임플란트 & 당일 식립 가능
- 최소 시술 원칙: 최소식립(상악 6개/하악 4개), 최소절개, 최소 뼈이식
- 평생안심 보증제: 임플란트 본체 평생, 상부보철물 10년, 어버트먼트 5년
- NGS 미생물 검사 기반 과학적 사후관리

### 잇몸 치료
- 자연치아 보존 최우선 철학
- NSK varios 970 초음파 스케일러, 페리오클린 항생 연고
- 4단계 통증 완화: 가글마취 → 도포마취 → 전동마취기 → 신경관마취

### 365일 진료
- 평일 야간진료, 주말/공휴일 정상진료
- 야간/주말에도 대표원장이 직접 진료

### 학술 활동
- 대표원장 저서 "치과의사가 알려주는 진짜 안전한 치과치료 이야기" 출판
- 오스템 임플란트, 디지털 치의학, 메가젠 디지털 스캔 세미나 강의
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
