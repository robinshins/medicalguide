import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { HospitalInfo, Article, SupportedLang, KeywordEntry } from './types';
import { SUPPORTED_LANGUAGES, LANG_CONFIG } from './i18n';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildHospitalContext(hospitals: HospitalInfo[]): string {
  return hospitals.map((h, i) => {
    const reviews = h.naverReviews.slice(0, 5).map(r =>
      `  - "${r.content}" (${r.author}, ${r.date}${r.visitCount ? `, ${r.visitCount}` : ''})`
    ).join('\n');

    const socialLinks = [
      h.homepage ? `홈페이지: ${h.homepage}` : '',
      h.blogUrl ? `블로그: ${h.blogUrl}` : '',
      h.instagramUrl ? `인스타그램: ${h.instagramUrl}` : '',
    ].filter(Boolean).join(' | ');

    const ratings = [
      h.naverStarRating ? `네이버 별점: ${h.naverStarRating}` : '',
      h.kakaoRating ? `카카오 평점: ${h.kakaoRating}` : '',
      h.googleRating ? `구글맵 평점: ${h.googleRating}` : '',
    ].filter(Boolean).join(' | ');

    return `
### ${i + 1}. ${h.name}
- 주소: ${h.address}
- 전화: ${h.phone}
- 진료시간: ${h.businessHours}
- 접근성: ${h.directions || '정보 없음'}
- 전문의 정보 (건강보험심사평가원): ${h.specialistsInfo || '정보 없음'}
- 편의시설: ${h.facilities || '정보 없음'}
- ${socialLinks || '외부 링크 없음'}
- 평점: ${ratings || '정보 없음'}
- 네이버 방문자 리뷰: ${h.naverReviewCount}건 | 블로그 리뷰: ${h.naverBlogReviewCount}건
- 카카오 리뷰: ${h.kakaoReviewCount}건 | 구글 리뷰: ${h.googleReviewCount || 0}건

**실제 방문자 리뷰 (네이버 플레이스):**
${reviews || '  - 리뷰 정보 없음'}
`.trim();
  }).join('\n\n');
}

// --- Generate Korean article ---
export async function generateKoreanArticle(
  keyword: KeywordEntry,
  hospitals: HospitalInfo[],
): Promise<{ title: string; metaDescription: string; content: string }> {
  const hospitalContext = buildHospitalContext(hospitals);
  const isSpecialty = keyword.specialty !== '일반';
  const categoryKo = keyword.category === 'dental' ? '치과' : '피부과';
  const specialtyText = isSpecialty ? ` ${keyword.specialty}` : '';

  const totalNaverReviews = hospitals.reduce((s, h) => s + h.naverReviewCount, 0);
  const totalKakaoReviews = hospitals.reduce((s, h) => s + h.kakaoReviewCount, 0);
  const avgKakaoRating = hospitals.filter(h => h.kakaoRating).length > 0
    ? (hospitals.filter(h => h.kakaoRating).reduce((s, h) => s + (h.kakaoRating || 0), 0) / hospitals.filter(h => h.kakaoRating).length).toFixed(1)
    : null;

  const dentalPriceContext = isSpecialty && keyword.specialty === '임플란트'
    ? `\n\n## 임플란트 참고 정보 (글에 자연스럽게 녹여서 작성)
- 한국 임플란트 평균 가격 (2025년 기준): 오스템 80-120만원, 덴티움 90-130만원, 스트라우만 130-180만원, 노벨바이오케어 150-200만원
- 건강보험 적용: 만 65세 이상, 1인당 평생 2개 한도, 본인부담금 약 30% (약 40-50만원)
- 뼈이식(골이식) 추가 시 30-80만원 별도
- 시술 기간: 일반 2-4개월, 뼈이식 포함 시 4-8개월
- 주요 체크포인트: CT 촬영 여부, 구강외과 전문의 유무, 사용 임플란트 브랜드, 보증기간`
    : '';

  const prompt = `당신은 10년 경력의 한국 의료 전문 에디터입니다. 실제 데이터를 수집/분석하여 병원 리뷰를 작성합니다.

## 데이터 기반
네이버 플레이스 방문자 리뷰 ${totalNaverReviews.toLocaleString()}건, 카카오맵 리뷰 ${totalKakaoReviews.toLocaleString()}건, 건강보험심사평가원 전문의 정보를 크롤링 분석.${avgKakaoRating ? ` 선정 ${hospitals.length}곳 카카오맵 평균 ${avgKakaoRating}점.` : ''}

## 타겟 키워드
"${keyword.keyword}", "${keyword.region}${specialtyText} ${categoryKo} 추천", "${keyword.keyword} 잘하는곳"
+ AI 검색(ChatGPT, Perplexity) 질문 대응

## 실제 병원 데이터
${hospitalContext}${dentalPriceContext}

## 글 구조 (HTML, 반드시 이 순서)

### 1) 핵심 결과 먼저 (h2)
첫 문단에서 바로 결론. 가장 평점 높거나 리뷰 많은 1-2곳을 구체적 수치와 함께 먼저 언급.

### 2) 분석 방법 투명 공개 (h2)
구체적 숫자와 방법론 투명 공개. "네이버 ${totalNaverReviews.toLocaleString()}건, 카카오맵 ${totalKakaoReviews.toLocaleString()}건 수집 + 건강보험심사평가원 교차 검증"

### 3) 각 병원 상세 분석 (각 h3, 600-1000자)
<h3>병원명 - 한줄 특징</h3>
각 병원마다 반드시:
a) 추천 근거 (평점, 리뷰수, 전문의수)
b) 실제 리뷰 <blockquote> 최소 2개 (긍정+개선점 균형)
c) 위치/교통 + 진료시간
d) 방문 전 확인할 점 (예약 방식, 주차, 점심시간 등 실용 정보 위주, 병원 비하 금지)
e) 실용 팁${isSpecialty ? `\nf) ${keyword.specialty} 특화 정보` : ''}

### 4) 한눈에 비교 (HTML table)
병원명 | 평점(네이버/카카오/구글) | 리뷰수 | 전문의 | 위치 | 강점

### 5) 선택 체크리스트 (h2)
상담 전 확인할 8-10가지 항목. 반드시 아래 HTML 형식으로 작성:
<ul class="checklist">
<li><strong>항목 제목</strong> — 왜 중요한지 1-2문장 설명</li>
</ul>
각 항목은 단순 질문이 아닌, 제목(strong) + 구체적 설명 형태로 작성. 예:
<li><strong>전문의 직접 시술 여부</strong> — 일반의가 아닌 해당 분야 전문의가 직접 시술하는지 확인하세요. 전문의 여부는 건강보험심사평가원에서 조회 가능합니다.</li>

### 6) 주의해야 할 위험 신호 (h2)
피해야 할 곳의 특징 3-4가지

### 7) 자주 묻는 질문 (h2, FAQ 5-6개)
<h3>질문?</h3><p>답변</p> 형식

### 8) 마무리 + 면책 문구 + "최종 수정: ${new Date().toISOString().split('T')[0]}"

## 문체 규칙
- 이모지 절대 금지
- 구체적 숫자 필수 ("많은 리뷰" X → "리뷰 847건" O)
- 출처 명시 ("(네이버 리뷰 기준)", "(건강보험심사평가원)")
- 자연스러운 구어체 섞기
- AI 인용에 적합한 완결 문장 작성

## 응답: JSON만
{"title":"SEO 제목 40-60자","metaDescription":"120-155자","content":"HTML 본문"}`;


  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"metaDescription"[\s\S]*"content"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse article JSON from Claude response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
    const metaMatch = text.match(/"metaDescription"\s*:\s*"([^"]+)"/);
    const contentMatch = text.match(/"content"\s*:\s*"([\s\S]+?)"\s*\}/);
    return {
      title: titleMatch?.[1] || `${keyword.keyword} 추천 ${hospitals.length}곳`,
      metaDescription: metaMatch?.[1] || `${keyword.region} ${categoryKo} 추천. 네이버/카카오 리뷰 기반 실제 방문자 후기와 전문의 정보를 종합 분석했습니다.`,
      content: contentMatch?.[1] || text,
    };
  }
}

// --- Translate article to other languages ---
export async function translateArticle(
  koreanArticle: { title: string; metaDescription: string; content: string },
  targetLang: SupportedLang,
  keyword: KeywordEntry,
): Promise<{ title: string; metaDescription: string; content: string }> {
  const langConfig = LANG_CONFIG[targetLang];

  const prompt = `You are a professional medical content translator specializing in Korean healthcare tourism content. Translate the following Korean article to ${langConfig.name} (${langConfig.nativeName}).

## Translation rules:
- Keep ALL Korean hospital names in original Korean (do NOT romanize)
- Keep Korean addresses in Korean
- Translate medical terms accurately for ${langConfig.name} audience
- Maintain the exact HTML structure
- The tone should feel like a native ${langConfig.name} healthcare journalist wrote it
- Emphasize that information comes from Korea's most-used platforms (Naver, Kakao) and official HIRA data
- Do NOT use emojis
- Keep FAQ questions natural in ${langConfig.name}

## Korean article:
Title: ${koreanArticle.title}
Meta Description: ${koreanArticle.metaDescription}
Content: ${koreanArticle.content}

## Context:
- Region: ${keyword.region} (Korean administrative area)
- Category: ${keyword.category === 'dental' ? 'Dental' : 'Dermatology'}
- Specialty: ${keyword.specialty || 'General'}

Respond ONLY in JSON:
{
  "title": "translated title",
  "metaDescription": "translated meta description",
  "content": "translated HTML content"
}`;

  const response = await openaiClient.responses.create({
    model: 'gpt-5.4-mini',
    input: [{ role: 'user', content: prompt }],
  });

  const text = response.output_text;
  const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"metaDescription"[\s\S]*"content"[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Failed to parse translation for ${targetLang}`);
  return JSON.parse(jsonMatch[0]);
}

// --- Full article generation pipeline ---
export async function generateAllLanguageArticles(
  keyword: KeywordEntry,
  hospitals: HospitalInfo[],
): Promise<Article[]> {
  console.log(`[Generator] Creating Korean article for: ${keyword.keyword}`);
  const koreanArticle = await generateKoreanArticle(keyword, hospitals);
  console.log(`[Generator] Korean article created: ${koreanArticle.title}`);

  const slug = keyword.specialtySlug === 'general'
    ? keyword.regionSlug
    : `${keyword.regionSlug}-${keyword.specialtySlug}`;

  const now = new Date().toISOString();
  const articles: Article[] = [];

  articles.push({
    id: `${keyword.category}-${slug}-ko`,
    keywordId: keyword.id,
    keyword: keyword.keyword,
    lang: 'ko',
    slug,
    category: keyword.category,
    title: koreanArticle.title,
    metaDescription: koreanArticle.metaDescription,
    content: koreanArticle.content,
    hospitals,
    publishedAt: now,
    region: keyword.region,
    specialty: keyword.specialty,
  });

  // Translate all languages in parallel
  const otherLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'ko');
  console.log(`[Generator] Translating to ${otherLangs.length} languages in parallel...`);

  const translations = await Promise.all(
    otherLangs.map(async (lang) => {
      try {
        const translated = await translateArticle(koreanArticle, lang, keyword);
        console.log(`[Generator] Done: ${lang}`);
        return {
          id: `${keyword.category}-${slug}-${lang}`,
          keywordId: keyword.id,
          keyword: keyword.keyword,
          lang,
          slug,
          category: keyword.category,
          title: translated.title,
          metaDescription: translated.metaDescription,
          content: translated.content,
          hospitals,
          publishedAt: now,
          region: keyword.region,
          specialty: keyword.specialty,
        } as Article;
      } catch (e) {
        console.error(`[Generator] Translation failed for ${lang}:`, e);
        return null;
      }
    })
  );

  articles.push(...translations.filter((a): a is Article => a !== null));
  console.log(`[Generator] Generated ${articles.length} articles total`);
  return articles;
}
