# Medical Korea Guide — Project Documentation

> 한국 치과/피부과 병원 정보를 13개 언어로 자동 발행하는 SEO 플랫폼

## 1. 시스템 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions (24x/일)                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │ Scraper  │──▶│ Matcher  │──▶│Generator │──▶│ Publish  │ │
│  │ Puppeteer│   │GPT-5.4-m │   │Claude+GPT│   │Firestore │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│   Naver Place    병원 매칭       한국어 글 생성    13개 언어    │
│   KakaoMap       (이름+주소)     + 12개 번역      저장         │
│   Google Maps                                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Vercel (Next.js 16)                       │
│   Firestore에서 읽기 → SSR/ISR → 웹 페이지 렌더링             │
│   /ko/dental/gangnam-implant                                 │
│   /en/dental/gangnam-implant                                 │
│   /ja/dental/gangnam-implant  ...                            │
└─────────────────────────────────────────────────────────────┘
```

**핵심 분리**: 글 생성(GitHub Actions)과 웹 서빙(Vercel)은 완전히 독립적. Vercel에서는 브라우저/AI API를 사용하지 않음.

## 2. 기술 스택

| 레이어 | 기술 | 용도 |
|--------|------|------|
| 프레임워크 | Next.js 16 (App Router) | SSR/ISR 페이지 렌더링 |
| UI | React 19 + Tailwind CSS 3 | 프론트엔드 |
| DB | Firebase Firestore | 글/키워드 큐/댓글 저장 |
| 스크래핑 | Puppeteer Core + @sparticuz/chromium | Naver/Kakao/Google 데이터 수집 |
| 글 생성 | Claude Sonnet 4 API | 한국어 원문 작성 |
| 번역 | GPT-5.4-mini | 12개 언어 병렬 번역 |
| 병원 매칭 | GPT-5.4-mini | 네이버↔카카오↔구글 동일병원 식별 |
| 배포 | Vercel | 웹 호스팅 + 백업 cron |
| CI/CD | GitHub Actions | 글 자동 발행 (24회/일) |
| 검색엔진 | IndexNow | 새 글 발행 시 Bing/Yandex 즉시 알림 |
| 분석 | Google Analytics (G-VVC2XX5P0N) | 트래픽 분석 |

## 3. 디렉토리 구조

```
src/
├── lib/                          # 서버 전용 핵심 모듈
│   ├── types.ts                  # TypeScript 인터페이스 (HospitalInfo, Article, KeywordEntry...)
│   ├── firebase.ts               # Firebase Admin 초기화 (Proxy 패턴, 빌드 시 안전)
│   ├── i18n.ts                   # 13개 언어 설정 + 전체 UI 번역 텍스트
│   ├── keywords.ts               # 9,025개 키워드 생성 (인구수 순 정렬)
│   ├── regions-data.json         # 인구통계 데이터 (행정안전부 주민등록인구)
│   ├── scraper.ts                # Puppeteer 스크래퍼 (Naver Place + Kakao + Google)
│   ├── matcher.ts                # GPT 기반 크로스플랫폼 병원 매칭
│   ├── generator.ts              # Claude 글 생성 + GPT 번역
│   ├── publish.ts                # 발행 오케스트레이터 (큐 관리 + Firestore 저장)
│   └── articles.ts               # Firestore 글 조회 (getArticles, getArticle, getAllSlugs)
│
├── app/
│   ├── layout.tsx                # 루트 레이아웃 (children만 반환)
│   ├── page.tsx                  # / → /ko 리다이렉트
│   ├── globals.css               # Tailwind + .article-content 스타일
│   ├── sitemap.ts                # 동적 사이트맵 (Firestore에서 발행된 글 자동 포함)
│   │
│   ├── [lang]/                   # 언어별 라우트 (ko, en, ja, zh-TW...)
│   │   ├── layout.tsx            # 헤더, 푸터, GA, 언어 선택기, 메타데이터
│   │   ├── page.tsx              # 홈페이지 (히어로 + 신뢰 섹션 + 최신 글)
│   │   └── [category]/           # dental 또는 dermatology
│   │       ├── page.tsx          # 카테고리 목록 페이지
│   │       └── [slug]/
│   │           └── page.tsx      # 글 상세 (JSON-LD, 병원 카드, 댓글, 언어 선택)
│   │
│   ├── api/
│   │   ├── cron/route.ts         # GET: Vercel cron 트리거 (CRON_SECRET 인증)
│   │   ├── publish/route.ts      # POST: 수동 발행 + 큐 초기화
│   │   ├── comments/route.ts     # GET/POST: 댓글 CRUD
│   │   └── img/route.ts          # GET: Naver 이미지 프록시 (핫링크 우회)
│   │
│   └── components/
│       ├── LangDropdown.tsx      # 언어 선택 드롭다운 (클라이언트)
│       └── Comments.tsx          # 댓글 위젯 (클라이언트)
│
├── .github/workflows/
│   └── publish.yml               # GitHub Actions: 24x/일 자동 발행
│
├── test-publish.js               # 로컬 테스트: 1개 글 발행
├── publish-action.js             # GitHub Actions용 발행 스크립트
├── indexnow-submit.js            # IndexNow 검색엔진 알림
└── vercel.json                   # 12개 Vercel cron 스케줄
```

## 4. 데이터 파이프라인 상세

### 4-1. 키워드 시스템 (`keywords.ts`)

**총 9,025개 키워드** = 475개 지역 × 19개 진료 키워드

| 구분 | 개수 | 예시 |
|------|------|------|
| 시/도 | 18 | 서울, 부산, 경기... |
| 시/구 (인구 상위) | 150 | 강남구, 수원, 분당... |
| 동 (인구 2만+) | ~270 | 목동, 잠실동, 역삼동... |
| 지하철역 | 35 | 강남역, 홍대입구역... |

**진료 키워드**:
- 치과 (6): 일반, 임플란트, 치아교정, 전체임플란트, 사랑니발치, 충치치료
- 피부과 (13): 일반, 보톡스, 필러, 레이저, 여드름, 흉터, 모공, 울쎄라, 써마지, 윤곽, 리프팅, 주름관리, 제모

**정렬**: 인구수 내림차순 → 치과 먼저 → 피부과

### 4-2. 스크래핑 (`scraper.ts`)

한 키워드당 실행 순서:

```
1. searchNaverPlaces("강남구 임플란트 치과")
   → 모바일 네이버 검색 → #place-app-root에서 상위 5개 병원 ID/이름 추출

2. getNaverPlaceInfo(placeId)  × 5개 병원
   → /hospital/{id}/home 방문
   → 스크롤 + 펼쳐보기 클릭 (lazy-loaded HIRA 데이터 로드)
   → 이름, 주소, 전화, 진료시간, 전문의(HIRA), 편의시설, SNS 링크, 이미지
   → /place/{id}/review/visitor 방문
   → 실제 방문자 리뷰 최대 8개 (텍스트, 작성자, 날짜, 방문횟수)

3. searchKakaoMap("강남구 임플란트 치과")
   → 카카오맵 모바일 검색 → 병원명, 평점, 리뷰수, 주소 추출

4. searchGoogleMaps("병원명 + 지역")  × 5개 병원
   → 구글맵 검색 → 평점, 리뷰수 추출
```

**소요 시간**: ~80초 (브라우저 1개 재사용, 병원당 카카오+구글 병렬)

### 4-3. 병원 매칭 (`matcher.ts`)

네이버 Top 5 ↔ 카카오/구글 결과를 동일 병원으로 매칭:

```
네이버: "연세우리집치과의원 송파석촌" (서울 송파구 백제고분로 364)
카카오 후보: ["연세우리집치과치과", "서울오브치과병원치과", ...]
   → GPT-5.4-mini에게 이름+주소+전화 비교 요청
   → confidence: 0.95 → "연세우리집치과치과" 매칭 확정
```

- 높은 confidence (>0.7) → 자동 매칭
- 낮은 confidence → 매칭 없음으로 처리 (잘못된 매칭보다 나음)
- 배치 처리: 미매칭 병원들을 한 번의 GPT 호출로 일괄 매칭 시도

### 4-4. 글 생성 (`generator.ts`)

**한국어 원문** (Claude Sonnet 4):
```
프롬프트에 포함되는 정보:
- 5개 병원의 전체 데이터 (주소, 평점, 리뷰 원문, 전문의 정보, SNS)
- 총 리뷰수 통계 (네이버 N건 + 카카오 N건)
- 임플란트의 경우 시세 참고 정보 (브랜드별 가격, 보험 적용 기준)

글 구조:
1. 핵심 결과 요약 (h2) — 가장 높은 평점/리뷰 1-2곳 바로 언급
2. 분석 방법 투명 공개 (h2) — 데이터 소스와 수집 건수
3. 각 병원 상세 분석 (h3 × 5) — 리뷰 인용, 위치, 전문의, 실용 팁
4. 비교 요약표 (HTML table)
5. 선택 체크리스트 (ul.checklist) — 상담 전 확인사항
6. 위험 신호 (h2) — 피해야 할 곳의 특징
7. FAQ (h3 질문 + p 답변) — AI 검색 최적화
8. 마무리 + 면책 문구 + 최종 수정일
```

**12개 언어 번역** (GPT-5.4-mini, 병렬):
- 한국어 병원명/주소는 원문 유지
- 각 언어 네이티브 의료 저널리스트 톤
- 재시도 로직 포함 (JSON 파싱 실패 시 최대 2회)

### 4-5. 발행 (`publish.ts`)

```
1. Firestore 'keywords' 컬렉션에서 status='pending' + order 오름차순 → 다음 키워드
2. status → 'in_progress'
3. 스크래핑 → 매칭 → 글 생성 → 13개 Article 문서 생성
4. Firestore batch write (articles 13개 + keyword status='published')
5. 실패 시 status → 'failed'
```

## 5. Firestore 데이터 모델

### `keywords` 컬렉션 (9,025 문서)

```typescript
{
  id: "dental-gangnam-implant",     // 문서 ID
  keyword: "강남 임플란트 치과",       // 검색어
  region: "강남",                    // 지역명
  regionSlug: "gangnam",            // URL slug
  specialty: "임플란트",              // 진료 키워드
  specialtySlug: "implant",
  category: "dental",               // dental | dermatology
  status: "pending",                // pending → in_progress → published | failed
  publishedAt: null,                // ISO 날짜
  order: 42                         // 발행 순서 (인구수 기반)
}
```

### `articles` 컬렉션 (발행된 글 × 13개 언어)

```typescript
{
  id: "dental-gangnam-implant-ko",  // {category}-{slug}-{lang}
  keywordId: "dental-gangnam-implant",
  keyword: "강남 임플란트 치과",
  lang: "ko",
  slug: "gangnam-implant",
  category: "dental",
  title: "강남구 임플란트 치과 추천 5곳...",
  metaDescription: "강남구 임플란트 치과 추천!...",
  content: "<h2>...</h2><p>...</p>",  // HTML
  hospitals: [                        // 요약 정보만 (전체 리뷰 텍스트 제외)
    { id, name, address, phone, businessHours, specialistsInfo,
      naverReviewCount, kakaoRating, kakaoReviewCount, googleRating, ... }
  ],
  publishedAt: "2026-03-22T...",
  region: "강남",
  specialty: "임플란트"
}
```

### `comments` 컬렉션

```typescript
{
  articleId: "dental-gangnam-implant-ko",
  nickname: "홍길동",
  content: "유용한 정보 감사합니다",
  createdAt: Timestamp
}
```

## 6. 프론트엔드 라우팅

| 경로 | 설명 | ISR |
|------|------|-----|
| `/` | → `/ko` 리다이렉트 | - |
| `/[lang]` | 홈페이지 (히어로 + 최신 글) | 30분 |
| `/[lang]/dental` | 치과 글 목록 | 30분 |
| `/[lang]/dermatology` | 피부과 글 목록 | 30분 |
| `/[lang]/[category]/[slug]` | 글 상세 | 1시간 |
| `/sitemap.xml` | 동적 사이트맵 | 1시간 |

**지원 언어** (13개): ko, en, zh-TW, zh-CN, ja, vi, th, ru, es, es-MX, pt-BR, de, it

## 7. API 엔드포인트

| 메서드 | 경로 | 인증 | 용도 |
|--------|------|------|------|
| GET | `/api/cron` | Bearer CRON_SECRET | Vercel cron 트리거 |
| POST | `/api/publish` | Bearer CRON_SECRET | 수동 발행 / 큐 초기화 |
| GET | `/api/comments?articleId=...` | 없음 | 댓글 조회 |
| POST | `/api/comments` | 없음 | 댓글 작성 |
| GET | `/api/img?url=...` | 없음 | Naver/Kakao 이미지 프록시 |

## 8. 자동화 (GitHub Actions)

**`.github/workflows/publish.yml`**:
- 하루 24회 실행 (30분 간격, 각각 다른 분에 실행)
- 0~10분 랜덤 딜레이 (패턴 감지 방지)
- Chrome 설치 → npm ci → .env.local 생성 → `node publish-action.js` 실행
- 발행 성공 시 IndexNow로 Bing/Yandex에 URL 제출

**`vercel.json`**:
- 백업용 12개 cron (Vercel 무료 플랜 제한)

## 9. SEO 최적화

- **JSON-LD**: Article + ItemList + FAQPage 스키마 자동 생성
- **메타 태그**: title, description, og:title, og:description, og:locale, alternates(hreflang)
- **사이트맵**: Firestore 발행 글 자동 포함
- **IndexNow**: 새 글 발행 즉시 검색엔진 알림
- **Naver 인증**: `naveracaef2d7c41b6acbb328f0783dfc325e.html`
- **AI 검색 최적화**: FAQ를 실제 검색어 형식으로, 인용 가능한 완결 문장

## 10. 환경 변수

| 변수 | 용도 | 필요한 곳 |
|------|------|-----------|
| `FIREBASE_PROJECT_ID` | Firestore 프로젝트 | Vercel + Actions |
| `FIREBASE_CLIENT_EMAIL` | Firebase 서비스 계정 | Vercel + Actions |
| `FIREBASE_PRIVATE_KEY` | Firebase 인증키 | Vercel + Actions |
| `FIREBASE_SERVICE_ACCOUNT` | JSON 전체 (Actions용) | Actions만 |
| `ANTHROPIC_API_KEY` | Claude API | Actions만 |
| `OPENAI_API_KEY` | GPT API | Actions만 |
| `CRON_SECRET` | Vercel cron 인증 | Vercel만 |
| `NEXT_PUBLIC_SITE_URL` | 사이트 URL | Vercel |

## 11. 로컬 개발

```bash
# 설치
npm install

# 환경 변수 (.env.local 필요)
# FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID
# ANTHROPIC_API_KEY, OPENAI_API_KEY

# 개발 서버
npm run dev          # localhost:3000

# 글 1개 테스트 발행
node test-publish.js

# 스크래핑만 테스트
node test-scrape-only.js

# 빌드
npm run build
```

## 12. 수치 요약

| 항목 | 값 |
|------|------|
| 전체 키워드 수 | 9,025 |
| 지원 언어 | 13 |
| 하루 발행 횟수 | 24 (GitHub Actions) |
| 하루 최대 글 수 | 24 × 13 = 312 |
| 전체 발행 완료까지 | ~376일 (9,025 ÷ 24) |
| 1회 발행 소요 시간 | ~5분 (스크래핑 80초 + 글 생성 120초 + 번역 50초) |
| Firestore 문서 (완료 시) | ~117,325 (9,025 × 13) |
