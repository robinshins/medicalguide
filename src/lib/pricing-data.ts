export interface PricingItem {
  name: string;
  insurance: string;
  priceRange: string;
  average: string;
  note?: string;
}

export interface PricingSection {
  title: string;
  description?: string;
  items: PricingItem[];
  footnote?: string;
}

export const DENTAL_PRICING_KO: {
  title: string;
  subtitle: string;
  intro: string;
  lastUpdated: string;
  sections: PricingSection[];
  factors: string[];
  sources: string[];
} = {
  title: '한국 치과 시술 평균 가격 가이드 (2025~2026)',
  subtitle: '보건복지부·건강보험심사평가원 공식 비급여 진료비 공개 자료 기반',
  intro: '이 가이드는 보건복지부·건강보험심사평가원(심평원) 공식 비급여 진료비 공개 자료(2025년 9월 발표)와 국내 주요 치과 정보 플랫폼(모두닥, 뱅크샐러드 등)의 조사 데이터를 종합하여 한국 치과 시술 항목별 평균 가격을 정리한 것입니다. 비급여 항목의 경우 병원·지역·재료에 따라 편차가 크므로, 아래 가격은 참고 기준값으로 활용하고 최종 비용은 방문 전 개별 치과에 반드시 확인해야 합니다.',
  lastUpdated: '2025-09',
  sections: [
    {
      title: '기본 예방·위생 처치',
      items: [
        { name: '스케일링 (건강보험 적용, 연 1회)', insurance: '급여', priceRange: '1~2만 원', average: '1.5만 원', note: '본인부담금 기준' },
        { name: '스케일링 (비급여, 서울·수도권)', insurance: '비급여', priceRange: '7~10만 원', average: '8만 원' },
        { name: '스케일링 (비급여, 지방)', insurance: '비급여', priceRange: '5~8만 원', average: '6만 원' },
        { name: '잇몸 치료 (치주 치료)', insurance: '급여', priceRange: '1,400~36,100원/회', average: '14,317원/회', note: '모두닥 1,439곳 조사 기준' },
      ],
    },
    {
      title: '충치 치료 (보존 치료)',
      description: '충치 진행 단계에 따라 치료 방법이 달라지고 비용도 크게 차이 납니다.',
      items: [
        { name: '아말감 (1단계 충치)', insurance: '급여', priceRange: '~1만 원', average: '1만 원' },
        { name: '레진 충전 (보험 적용)', insurance: '급여', priceRange: '7~15만 원', average: '9만 원' },
        { name: '레진 충전 (비급여, 앞니)', insurance: '비급여', priceRange: '7~15만 원', average: '10만 원' },
        { name: '레진 충전 (비급여, 어금니)', insurance: '비급여', priceRange: '10~20만 원', average: '15만 원' },
        { name: '인레이 (2단계 충치)', insurance: '비급여', priceRange: '20~40만 원', average: '29만 원' },
        { name: '온레이 (2단계 충치)', insurance: '비급여', priceRange: '25~45만 원', average: '33만 원' },
        { name: '크라운 (3단계, 광범위)', insurance: '비급여', priceRange: '50~70만 원', average: '60만 원' },
      ],
    },
    {
      title: '신경 치료 (근관 치료)',
      description: '건강보험이 적용되는 급여 항목으로 1회당 비용이 비교적 낮습니다.',
      items: [
        { name: '신경 치료 (치과의원, 1회)', insurance: '급여', priceRange: '~1.5만 원', average: '11,120원' },
        { name: '신경 치료 (치과병원, 1회)', insurance: '급여', priceRange: '~2만 원', average: '15,660원' },
        { name: '신경 치료 (종합병원, 1회)', insurance: '급여', priceRange: '~2.5만 원', average: '19,720원' },
        { name: '신경 치료 (상급종합, 1회)', insurance: '급여', priceRange: '~3만 원', average: '25,230원' },
      ],
      footnote: '앞니(단근관) 3회 내원 시 약 35,500원, 어금니(4근관) 3회 내원 시 약 79,600원 본인 부담. 치료 후 크라운 보철 추가 비용 발생 가능.',
    },
    {
      title: '크라운 (보철 치료)',
      description: '비급여 항목으로 재료에 따라 가격 차이가 큽니다. 2025년 심평원 공개 자료 기준.',
      items: [
        { name: '금 크라운 (Gold)', insurance: '비급여', priceRange: '45~60만 원', average: '50만 원', note: '일반 치과 시세' },
        { name: 'PFM (도재-금속)', insurance: '비급여', priceRange: '50~70만 원', average: '60만 원' },
        { name: '지르코니아 (Zirconia)', insurance: '비급여', priceRange: '50~80만 원', average: '70만 원', note: '일반 치과 시세' },
        { name: '지르코니아 (심평원 전국 평균)', insurance: '비급여', priceRange: '-', average: '114만 원', note: '대학병원 포함 평균' },
        { name: '금 (심평원 전국 평균)', insurance: '비급여', priceRange: '-', average: '156.5만 원', note: '대학병원 포함 평균' },
      ],
    },
    {
      title: '임플란트',
      description: '1치아 기준(식립술+상부구조+보철). 2025년 심평원 자료 기준 최저 55만 원~최고 461만 원.',
      items: [
        { name: '치과의원 전국 평균', insurance: '비급여', priceRange: '80~150만 원', average: '115만 원' },
        { name: '치과병원 전국 평균', insurance: '비급여', priceRange: '120~200만 원', average: '165만 원' },
        { name: '실제 시장 가격 범위', insurance: '비급여', priceRange: '150~300만 원', average: '-' },
        { name: '풀 아치 (한쪽 전체)', insurance: '비급여', priceRange: '900~2,000만 원', average: '-' },
        { name: '풀 마우스 (양쪽 전체)', insurance: '비급여', priceRange: '1,800~4,000만 원', average: '-' },
      ],
      footnote: '만 65세 이상은 2개 치아까지 건강보험 적용 (본인부담 30%).',
    },
    {
      title: '치아 교정 (교정 치료)',
      description: '대한치과교정학회 2024년 통계 기준, 국내 평균 350만~600만 원.',
      items: [
        { name: '금속(메탈) 교정', insurance: '비급여', priceRange: '250만~600만 원', average: '400만 원', note: '가장 경제적' },
        { name: '세라믹 교정', insurance: '비급여', priceRange: '400만~700만 원', average: '550만 원', note: '투명 재질' },
        { name: '투명 교정 (인비절라인 등)', insurance: '비급여', priceRange: '500만~1,000만 원', average: '700만 원', note: '탈착 가능' },
        { name: '설측(혀쪽) 교정', insurance: '비급여', priceRange: '700만~1,500만 원', average: '1,000만 원', note: '외부 미노출' },
        { name: '부분 투명 교정', insurance: '비급여', priceRange: '70만~250만 원', average: '150만 원' },
      ],
      footnote: '추가 비용: 초기 검사비 10~40만 원, 월 조정비 5~10만 원, 유지장치 20~50만 원.',
    },
    {
      title: '심미 시술',
      items: [
        { name: '라미네이트 (서울 강남권)', insurance: '비급여', priceRange: '43~120만 원/개', average: '70만 원/개' },
        { name: '라미네이트 (경기도)', insurance: '비급여', priceRange: '31~40만 원/개', average: '35만 원/개' },
        { name: '라미네이트 (지방)', insurance: '비급여', priceRange: '27~37만 원/개', average: '32만 원/개' },
        { name: '전문가 미백 (1회)', insurance: '비급여', priceRange: '10~40만 원', average: '20만 원' },
        { name: '원데이 패키지 (스케일링+미백)', insurance: '비급여', priceRange: '20~50만 원', average: '35만 원' },
        { name: '자가 미백 키트', insurance: '비급여', priceRange: '5~15만 원', average: '10만 원' },
      ],
    },
  ],
  factors: [
    '지역: 서울 강남권은 지방 대비 20~40% 높은 경향',
    '병원 규모: 치과의원 < 치과병원 < 종합병원 < 상급종합병원 순으로 상승',
    '재료 선택: 금·도재·지르코니아 등 재료에 따라 동일 항목도 2~3배 차이',
    '건강보험 적용 여부: 신경 치료·스케일링·잇몸 치료 등 급여 항목은 본인 부담 30% 수준',
    '노인 임플란트 급여: 만 65세 이상은 2개까지 건강보험 적용으로 본인 부담 대폭 절감',
  ],
  sources: [
    '건강보험심사평가원 비급여 진료비 정보 공개 (2025.09)',
    '보건복지부 비급여 진료비용 등의 공개에 관한 기준',
    '모두닥 치과 가격 조사 데이터 (2026.03)',
    '대한치과교정학회 교정 치료 통계 (2024)',
  ],
};

export const DERMA_PRICING_KO: typeof DENTAL_PRICING_KO = {
  title: '피부과 시술 평균 가격 총정리 (2026년 기준)',
  subtitle: '모두닥 실거래가 + 건강보험심사평가원 공식 비급여 진료비 기반',
  intro: '아래 가격은 2025~2026년 국내 피부과 기준 평균·범위이며, 병원 위치(강남/비강남), 의료진 경력, 사용 장비·제품 등에 따라 편차가 큽니다. 부가세 포함 여부는 병원마다 다르며, 2026년 3월 기준 모두닥(modoodoc.com) 실거래 데이터를 주로 참조하였습니다.',
  lastUpdated: '2026-03',
  sections: [
    {
      title: '보톡스',
      description: '주름 개선, 사각턱 축소, 다한증 치료 등에 사용되는 보툴리눔 톡신 주사.',
      items: [
        { name: '이마 보톡스', insurance: '비급여', priceRange: '3~8만 원', average: '5만 원' },
        { name: '미간 보톡스', insurance: '비급여', priceRange: '3~7만 원', average: '5만 원' },
        { name: '눈가 보톡스 (까마귀발)', insurance: '비급여', priceRange: '3~8만 원', average: '5만 원' },
        { name: '사각턱 보톡스 (양쪽)', insurance: '비급여', priceRange: '5~15만 원', average: '10만 원' },
        { name: '입꼬리 보톡스', insurance: '비급여', priceRange: '3~7만 원', average: '5만 원' },
        { name: '승모근 보톡스 (어깨)', insurance: '비급여', priceRange: '10~30만 원', average: '20만 원' },
        { name: '다한증 보톡스 (겨드랑이)', insurance: '비급여', priceRange: '20~50만 원', average: '35만 원' },
        { name: '전체 얼굴 보톡스', insurance: '비급여', priceRange: '15~40만 원', average: '25만 원' },
      ],
      footnote: '제품 브랜드(보톡스/디스포트/제오민/나보타 등)에 따라 가격 차이. 효과 지속 3~6개월.',
    },
    {
      title: '필러',
      description: '히알루론산 등 충전제를 주입하여 볼륨을 채우거나 주름을 개선하는 시술.',
      items: [
        { name: '팔자주름 필러 (1cc)', insurance: '비급여', priceRange: '15~40만 원', average: '25만 원' },
        { name: '입술 필러 (1cc)', insurance: '비급여', priceRange: '15~35만 원', average: '25만 원' },
        { name: '턱 필러 (1~2cc)', insurance: '비급여', priceRange: '20~50만 원', average: '35만 원' },
        { name: '코 필러 (1cc)', insurance: '비급여', priceRange: '15~40만 원', average: '30만 원' },
        { name: '이마 필러 (2~4cc)', insurance: '비급여', priceRange: '40~100만 원', average: '60만 원' },
        { name: '볼 필러 (2~4cc)', insurance: '비급여', priceRange: '40~80만 원', average: '55만 원' },
        { name: '눈밑 (다크서클) 필러', insurance: '비급여', priceRange: '20~50만 원', average: '35만 원' },
      ],
      footnote: '제품(레스틸렌/쥬비덤/벨로테로 등)과 용량에 따라 가격 차이. 효과 지속 6~18개월.',
    },
    {
      title: '레이저 시술',
      description: '피부 재생, 색소 치료, 모공 축소 등 다양한 목적의 레이저 치료.',
      items: [
        { name: '피코 레이저 (색소/잡티)', insurance: '비급여', priceRange: '5~15만 원/회', average: '10만 원/회' },
        { name: '프락셀 레이저 (흉터/모공)', insurance: '비급여', priceRange: '15~40만 원/회', average: '25만 원/회' },
        { name: 'CO2 레이저 (점/사마귀 제거)', insurance: '비급여', priceRange: '1~5만 원/개', average: '2만 원/개' },
        { name: 'IPL (안면홍조/색소)', insurance: '비급여', priceRange: '5~15만 원/회', average: '10만 원/회' },
        { name: '엑셀V (혈관/홍조)', insurance: '비급여', priceRange: '10~30만 원/회', average: '20만 원/회' },
        { name: '제네시스 (피부결/톤)', insurance: '비급여', priceRange: '5~15만 원/회', average: '10만 원/회' },
        { name: '레이저 토닝 (미백)', insurance: '비급여', priceRange: '3~10만 원/회', average: '7만 원/회' },
      ],
      footnote: '보통 5~10회 패키지로 진행. 패키지 시 회당 가격 20~30% 할인.',
    },
    {
      title: '울쎄라 / 써마지 (리프팅)',
      description: '비수술 리프팅 시술. 초음파(울쎄라) 또는 고주파(써마지)를 이용한 피부 탄력 개선.',
      items: [
        { name: '울쎄라 (전체 얼굴)', insurance: '비급여', priceRange: '150~400만 원', average: '250만 원' },
        { name: '울쎄라 (부분, 턱선/이마)', insurance: '비급여', priceRange: '50~150만 원', average: '100만 원' },
        { name: '써마지 FLX (전체 얼굴, 900샷)', insurance: '비급여', priceRange: '80~200만 원', average: '130만 원' },
        { name: '써마지 FLX (눈가, 450샷)', insurance: '비급여', priceRange: '50~100만 원', average: '70만 원' },
        { name: '인모드 (고주파 리프팅)', insurance: '비급여', priceRange: '30~80만 원', average: '50만 원' },
        { name: '슈링크 유니버스', insurance: '비급여', priceRange: '15~50만 원', average: '30만 원' },
        { name: '실 리프팅 (PDO 실)', insurance: '비급여', priceRange: '30~150만 원', average: '80만 원', note: '실 종류/개수에 따라' },
      ],
      footnote: '울쎄라/써마지는 정품 팁 사용 여부 반드시 확인. 효과 지속 6~12개월.',
    },
    {
      title: '여드름 / 흉터 / 모공 치료',
      items: [
        { name: '여드름 압출 + 관리', insurance: '비급여', priceRange: '3~10만 원/회', average: '5만 원/회' },
        { name: '여드름 PDT (광역학치료)', insurance: '비급여', priceRange: '10~25만 원/회', average: '15만 원/회' },
        { name: '여드름 약물 치료 (로아큐탄 등)', insurance: '혼합', priceRange: '3~8만 원/월', average: '5만 원/월', note: '보험 적용 여부에 따라' },
        { name: '여드름 흉터 프락셀', insurance: '비급여', priceRange: '15~40만 원/회', average: '25만 원/회' },
        { name: '서브시전 (흉터 박리술)', insurance: '비급여', priceRange: '10~30만 원/회', average: '20만 원/회' },
        { name: '모공 축소 레이저', insurance: '비급여', priceRange: '5~20만 원/회', average: '12만 원/회' },
        { name: 'MTS (미세침 치료)', insurance: '비급여', priceRange: '5~15만 원/회', average: '10만 원/회' },
      ],
    },
    {
      title: '스킨부스터 / 주사 시술',
      description: '피부 재생·수분·탄력 개선을 위한 주사 시술. 제품 브랜드·용량에 따라 가격 차이가 큼.',
      items: [
        { name: '물광주사 (히알루론산)', insurance: '비급여', priceRange: '7~33만 원', average: '15만 원', note: '기본 수분 보충' },
        { name: '리쥬란힐러 (2cc)', insurance: '비급여', priceRange: '22~30만 원', average: '26만 원', note: 'PDRN 성분, 피부 재생' },
        { name: '쥬베룩 (2cc)', insurance: '비급여', priceRange: '19~45만 원', average: '30만 원', note: 'PLA+HA 복합' },
        { name: '쥬베룩볼륨', insurance: '비급여', priceRange: '24~50만 원', average: '35만 원' },
        { name: '연어주사 (PDRN)', insurance: '비급여', priceRange: '12~15만 원', average: '13만 원' },
        { name: '엑소좀 (3~6cc)', insurance: '비급여', priceRange: '22~36만 원', average: '29만 원', note: '줄기세포 유래 성장인자' },
        { name: '스컬트라 (5cc)', insurance: '비급여', priceRange: '55~89만 원', average: '70만 원', note: '콜라겐 자극·볼륨' },
        { name: '백옥주사/신데렐라주사', insurance: '비급여', priceRange: '3~8만 원', average: '5만 원', note: '글루타치온 미백' },
        { name: '비타민C 주사', insurance: '비급여', priceRange: '2.9~7만 원', average: '5만 원' },
      ],
      footnote: '모두닥 2026년 3월 실거래 데이터 기준.',
    },
    {
      title: '윤곽 / 체형 시술',
      items: [
        { name: '윤곽 주사 (얼굴)', insurance: '비급여', priceRange: '5~20만 원/회', average: '10만 원/회' },
        { name: '지방 분해 주사 (턱선/볼)', insurance: '비급여', priceRange: '5~15만 원/회', average: '10만 원/회' },
        { name: '지방 분해 주사 (복부/팔뚝)', insurance: '비급여', priceRange: '10~30만 원/회', average: '20만 원/회' },
        { name: '쿨스컬프팅 (냉각지방분해)', insurance: '비급여', priceRange: '20~50만 원/부위', average: '35만 원/부위' },
      ],
    },
    {
      title: '피부관리 (기초 케어)',
      items: [
        { name: '아쿠아필', insurance: '비급여', priceRange: '2.9~5만 원', average: '4만 원', note: '각질·피지 클렌징' },
        { name: '일반 피부관리', insurance: '비급여', priceRange: '3,300~33만 원', average: '85,141원', note: '전국 406곳 평균' },
        { name: 'LDM (물방울 리프팅)', insurance: '비급여', priceRange: '5.9~15만 원', average: '10만 원' },
        { name: '블랙필/라라필', insurance: '비급여', priceRange: '4.5~8만 원', average: '6만 원' },
      ],
    },
    {
      title: '제모',
      description: '레이저 제모는 부위와 횟수에 따라 가격이 달라집니다. 보통 5~8회 패키지.',
      items: [
        { name: '겨드랑이 제모 (1회)', insurance: '비급여', priceRange: '3~8만 원', average: '5만 원' },
        { name: '팔 전체 제모 (1회)', insurance: '비급여', priceRange: '8~20만 원', average: '12만 원' },
        { name: '다리 전체 제모 (1회)', insurance: '비급여', priceRange: '15~35만 원', average: '25만 원' },
        { name: '비키니 라인 제모 (1회)', insurance: '비급여', priceRange: '5~15만 원', average: '10만 원' },
        { name: '남성 수염 제모 (1회)', insurance: '비급여', priceRange: '5~15만 원', average: '10만 원' },
        { name: '전신 제모 (1회)', insurance: '비급여', priceRange: '30~80만 원', average: '50만 원' },
      ],
      footnote: '패키지(5~8회) 구매 시 회당 가격 30~50% 할인. 의료용 레이저 장비 사용 여부 확인.',
    },
  ],
  factors: [
    '지역: 서울 강남권은 지방 대비 30~50% 높은 경향',
    '장비: 정품 팁 사용 여부, 최신 장비 vs 구형 장비에 따라 가격 차이',
    '시술 범위: 전체 얼굴 vs 부분 시술에 따라 2~3배 차이',
    '패키지: 단회 vs 패키지(5~10회)에 따라 회당 가격 30~50% 차이',
    '제품 브랜드: 보톡스/필러 등 정품 브랜드에 따라 가격 차이',
  ],
  sources: [
    '건강보험심사평가원 비급여 진료비 정보 공개 (2025.09)',
    '보건복지부 비급여 진료비용 등의 공개에 관한 기준',
    '모두닥(modoodoc.com) 실거래가 데이터 (2026.03)',
    '국내 주요 피부과 가격 비교 플랫폼 조사 데이터',
  ],
};
