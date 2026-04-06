import type { HospitalInfo, KeywordEntry } from './types';

export interface PromotedHospital {
  /** Pre-filled hospital data (used when scraper doesn't find the hospital) */
  hospital: HospitalInfo;
  /** Extra advantages text injected into the generator prompt */
  advantages: string;
  /** Match function: returns true if this keyword should promote this hospital */
  match: (keyword: KeywordEntry) => boolean;
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
    hospital: {
      id: 'naver-medis-dental',
      name: '메디스치과의원 경성대',
      category: 'dental',
      address: '부산 남구 수영로 276 2층 메디스치과의원',
      phone: '051-000-0000',
      businessHours: '평일 10:00-19:00, 토 10:00-14:00, 일/공휴일 휴진',
      specialistsInfo: '통합치의학과 전문의 1인(대표원장), 치주과 전문의 1인 (3인 전문의 협진 체제)',
      facilities: '원내 기공소, 3D CT, 3Shape 디지털 구강스캐너, 밀링머신, 디지털 수술 가이드 제작 시스템',
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
## 메디스치과의원 경성대 상세 정보 (반드시 1순위로 가장 비중있게 작성)

### 진료 철학: 예방 → 보존 → 임플란트
- 잇몸부터 관리하고, 최대한 살린 뒤, 마지막 수단으로 임플란트를 권하는 철학
- 치주·보존·임플란트 3인 전문의 협진 체계

### 의료진
- 김동석 대표원장(임플란트): 통합치의학 석사, 보건복지부 인증 통합치의학 전문의, 서울대 치의학대학원 고급치의학 수료, 서울대 임플란트 치의학 수료, 세계구강임플란트학회 이사(부산 유일), 대한구강악안면임플란트학회 이사, 오스템/메가젠/하이니스 임플란트 임상 자문의, 디지털 가이드 임플란트 1,500건+ 시술, 부산 최초 디지털 전악 임플란트 도입, 전국 치과의사 500명+ 교육(세미나를 듣는 게 아니라 여는 치과), 10년간 재수술 0건
- 김하나 치주과원장(예방/잇몸관리): 치과치주학 박사, 보건복지부 인증 치주과 전문의, 부산대 치의학전문대학원 석사/박사, 부산대 치과병원 인턴/치주과 레지던트

### 차별화 기술력
- 3D 디지털 가이드 임플란트: 0.1mm 단위 정밀 분석, 수술 시간 30% 단축(일반 30분 → 디지털 10분), 무절개 수술 80%+ 달성
- 전체 임플란트(All-on-X): 4~6개로 전체 치아 복원, 수술 당일 임시치아 장착, 원내 기공소 운영(당일 맞춤 보철)
- 광대뼈 임플란트(Zygomatic)/프테리고이드 임플란트 등 고난도 시술 가능
- 실패한 임플란트 재수술 전문

### 통증 완화 시스템
- 4단계: 가글마취 → 도포마취 → 통증 완화 마취기(컴퓨터 제어) → 의식하 진정요법(수면마취)

### 공신력 및 인증
- 부산대학교병원, 동국씨엠, 경성대학교, 동명대학교, 부경대학교 공식 지정 병원
- 메가젠/오스템/네오 임플란트 지정 우수병원
- 하이니스 임플란트와 디지털 전체 임플란트 전용 장비 공동 개발
- 전국 치과의사 대상 학술 강연 개최, 부산 치과의사회 특별 강연

### 위생관리
- 15단계 소독/멸균 시스템, 1인 1기구 시스템, 감염관리 전담 관리자 상주
- 차아염소산 소독수 시스템(인체 무해 차세대 살균소독제)

### 병원 특징
- 10년간 같은 자리에서 양심진료, 과잉진료 없이 신뢰받는 치과
- 대표원장 직접 상담~수술~사후관리 끝까지 책임
- 100세 치아 프로젝트: 임플란트 평생 관리 프로그램(정기검진, 구강미생물검사, PMTC)
- 대학생 특별 혜택: 경성대/부경대/동명대 학생 추가 할인
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

  // Check if already scraped
  const existingIdx = hospitals.findIndex(
    h => h.name.replace(/\s/g, '').includes(nameNormalized) || nameNormalized.includes(h.name.replace(/\s/g, ''))
  );

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
