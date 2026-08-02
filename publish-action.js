// ── OpenAI 토큰 사용량 집계 ────────────────────────────────────────────────
// 모든 사이트가 하나의 OpenAI 키를 공유하고, 그 키의 일일 무료 한도가 실제 예산
// 상한이다. 번역(12개 언어)이 이 파이프라인의 OpenAI 소비 대부분을 차지하므로
// 호출 지점마다 usage를 기록해 1회 발행당 실소비를 남긴다.
const TOKENS = { calls: 0, input: 0, output: 0, byLabel: {} };
function recordUsage(label, u) {
  if (!u) return;
  const i = u.input_tokens ?? u.prompt_tokens ?? 0;
  const o = u.output_tokens ?? u.completion_tokens ?? 0;
  TOKENS.calls++; TOKENS.input += i; TOKENS.output += o;
  const b = TOKENS.byLabel[label] || (TOKENS.byLabel[label] = { calls: 0, input: 0, output: 0 });
  b.calls++; b.input += i; b.output += o;
}
function usageSummary() {
  const lines = Object.entries(TOKENS.byLabel).map(([k, b]) =>
    `    ${k.padEnd(12)} calls=${String(b.calls).padStart(3)} in=${String(b.input).padStart(7)} out=${String(b.output).padStart(6)}`);
  lines.push(`    ${'TOTAL'.padEnd(12)} calls=${String(TOKENS.calls).padStart(3)} in=${String(TOKENS.input).padStart(7)} out=${String(TOKENS.output).padStart(6)} → ${TOKENS.input + TOKENS.output} tokens`);
  return lines.join('\n');
}

/**
 * 짝 없는 서로게이트 제거.
 *
 * 네이버 리뷰는 본문이 잘린 채 오는 경우가 있어 이모지가 중간에서 끊긴다
 * (U+D83D 뒤에 low surrogate 없음). 이 문자가 프롬프트에 실리면 JSON.stringify가
 * 문법상 유효한 \ud83d 이스케이프를 만들지만 UTF-16으로는 깨진 값이라 LLM API가
 * 요청 본문 파싱을 거부한다("400 Invalid body: failed to parse JSON value").
 * 결정론적 실패라 재시도 3회가 전부 같은 이유로 죽고 키워드가 failed로 확정된다.
 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
function cleanDeep(v) {
  if (typeof v === 'string') return v.replace(LONE_SURROGATE, '');
  if (Array.isArray(v)) return v.map(cleanDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = cleanDeep(x);
    return o;
  }
  return v;
}


const puppeteer = require('puppeteer-core');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Init ---
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: 'medicalkorea-2205a.firebasestorage.app' });
const db = admin.firestore();
require('dotenv').config({ path: '.env.local' });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const delay = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

// 한국어 원문 생성 모델.
//
// 2026-07-26에 claude-sonnet-5 → deepseek-v4-pro로 교체. 같은 프롬프트·같은 스크랩
// 데이터로 비교했을 때(compare-models.js) 구조·수치 정확도는 동등했고(7/7), 본문은
// 40% 길었으며, 데이터에 대한 해석이 더 붙었다. 비용은 1/13이다($21/월 → $1.6/월).
//
// 처음 비교에서 Pro가 방법론을 지어냈지만(하지 않은 스팸 필터링·설문조사·표본 선별),
// 원인은 프롬프트가 수집하지 않는 데이터를 요구한 것이었다("점심시간 명시", "위치/교통",
// "방법론 투명 공개"). 프롬프트를 조인 뒤 3회 재검증에서 재발하지 않았다.
// 허용 외 태그(<small>, <br>)는 저장 직전 sanitizeHtml()이 제거한다.
//
// ARTICLE_MODEL 환경변수로 덮어쓸 수 있다. claude-* 이름이면 Anthropic 경로로 간다.
const ARTICLE_MODEL = process.env.ARTICLE_MODEL || 'deepseek-v4-pro';

// 번역문에 넣을 언어별 "외국인 환자 관점" 표현.
//
// 왜 필요한가: 지금까지 번역문은 한국어 원문을 그대로 옮긴 것이라, 외국인이 실제로
// 검색하는 표현("English-speaking dentist in Gangnam", "英語対応")이 본문에 아예
// 없었다. AI 검색(ChatGPT/Perplexity)은 그 의도로 질문을 받으므로, 해당 표현이
// 문서에 없으면 인용 후보에 오르지 못한다.
//
// nativeQuery: 그 언어권 사용자가 실제로 입력하는 검색어 형태
// angle: 번역가에게 추가로 요구할 관점 (원문에 없는 사실을 지어내라는 뜻이 아니라,
//        수집된 데이터를 외국인 관점에서 재서술하라는 뜻)
const GEO_HINTS = {
  'en': {
    nativeQuery: 'English-speaking dentist / dental clinic in {region}, foreigner-friendly, expat',
    angle: 'foreign residents and medical tourists who need English-speaking staff, and who care about international patient services, payment methods, and appointment booking in English',
    mustInclude: 'English-speaking',
  },
  'ja': {
    nativeQuery: '{region} 歯科 日本語対応 / 韓国 歯科 おすすめ / 医療ツーリズム',
    angle: '日本から医療ツーリズムで訪韓する患者、および在韓日本人。日本語対応の有無、予約方法、日本の治療費との比較に関心がある',
    mustInclude: '日本語対応',
  },
  'zh-TW': {
    nativeQuery: '{region} 牙科 中文服務 / 韓國 牙科 推薦 / 醫療觀光',
    angle: '從台灣、香港來韓國進行醫療觀光的患者，以及在韓華人。關心是否有中文服務、預約方式、與當地費用的比較',
    mustInclude: '中文服務',
  },
  'zh-CN': {
    nativeQuery: '{region} 牙科 中文服务 / 韩国 牙科 推荐 / 医疗旅游',
    angle: '来韩国医疗旅游的中国患者和在韩华人。关心是否提供中文服务、预约流程、费用对比',
    mustInclude: '中文服务',
  },
  'vi': {
    nativeQuery: 'nha khoa nói tiếng Việt ở {region} / nha khoa Hàn Quốc cho người Việt',
    angle: 'người Việt đang sinh sống, du học hoặc lao động tại Hàn Quốc, quan tâm đến hỗ trợ tiếng Việt, bảo hiểm và chi phí',
    mustInclude: 'nói tiếng Việt',
  },
  'th': {
    nativeQuery: 'คลินิกทันตกรรมใน {region} ที่พูดภาษาอังกฤษได้ / ทันตกรรมเกาหลี',
    angle: 'นักท่องเที่ยวเชิงการแพทย์จากไทยและคนไทยที่อาศัยในเกาหลี สนใจการสื่อสารภาษาอังกฤษ การนัดหมาย และค่าใช้จ่าย',
    mustInclude: 'พูดภาษาอังกฤษ',
  },
  'ru': {
    nativeQuery: 'стоматология в {region} с англоговорящим персоналом / лечение зубов в Корее',
    angle: 'русскоязычные пациенты, приезжающие в Корею на лечение, и экспаты. Важны языковая поддержка, запись на приём и сравнение стоимости',
    mustInclude: 'англоговорящ',
  },
  'es': {
    nativeQuery: 'dentista que habla inglés en {region} / clínica dental en Corea',
    angle: 'pacientes hispanohablantes que viajan a Corea por turismo médico y expatriados; les importa la atención en inglés, la reserva de cita y el coste',
    mustInclude: 'que habla inglés',
  },
  'es-MX': {
    nativeQuery: 'dentista que habla inglés en {region} / clínica dental en Corea',
    angle: 'pacientes de México y Latinoamérica que viajan a Corea por turismo médico; les importa la atención en inglés, cómo agendar cita y el costo',
    mustInclude: 'que habla inglés',
  },
  'pt-BR': {
    nativeQuery: 'dentista que fala inglês em {region} / clínica odontológica na Coreia',
    angle: 'pacientes brasileiros em turismo médico na Coreia e expatriados; interessam-se por atendimento em inglês, agendamento e comparação de custos',
    mustInclude: 'que fala inglês',
  },
  'de': {
    nativeQuery: 'englischsprachiger Zahnarzt in {region} / Zahnklinik in Korea',
    angle: 'deutschsprachige Expats und Medizintouristen in Korea; wichtig sind englischsprachige Betreuung, Terminvereinbarung und Kostenvergleich',
    mustInclude: 'englischsprachig',
  },
  'it': {
    nativeQuery: 'dentista che parla inglese a {region} / clinica dentale in Corea',
    angle: 'pazienti italiani in turismo medico in Corea ed expat; contano l’assistenza in inglese, la prenotazione e il confronto dei costi',
    mustInclude: 'che parla inglese',
  },
};


// 번역 프롬프트 빌더. scratch/테스트에서 이 함수를 직접 require 해 검증하므로,
// 프롬프트 문자열이 두 곳으로 갈라지지 않는다.
function buildTranslationPrompt({ lang, langName, region, category, koArticle }) {
  const geo = GEO_HINTS[lang];
  const nativeQuery = (geo?.nativeQuery || '').replace(/\{region\}/g, region);
  const categoryEn = category === 'dental' ? 'dental clinic' : 'dermatology clinic';
  return `You are localizing a Korean medical article about ${region} ${categoryEn}s for ${langName} readers.

This is LOCALIZATION, not literal translation. The audience is:
${geo?.angle || `${langName} speakers looking for medical care in Korea`}

Requirements:
1. Translate the article into natural, native-quality ${langName}. Maintain the HTML structure exactly (same tags, same order). No emojis.
2. Keep Korean clinic names and addresses in Korean script, but add a romanized form in parentheses the FIRST time each clinic name appears, e.g. 강남서울치과 (Gangnam Seoul Dental).
3. THE PLACE NAME "${region}" MUST be written in a form this audience can read and search.
   - For Latin-script languages: use the romanized name (${region} → its standard romanization) as the primary form. You may add the Korean in parentheses once.
   - For Japanese: use katakana or the Japanese reading, e.g. カンナム / 江南.
   - For Chinese: use the Chinese reading of the place name.
   - NEVER leave raw Hangul as the only form of the place name in the title or meta description. A ${langName} reader cannot type Hangul into a search box.
4. Add ONE short paragraph (2-3 sentences) near the top, right after the first <h2> section, written for this audience. It should address what a foreign patient needs to know when visiting a clinic in ${region}: language support, how to make an appointment, and what to bring. Frame it honestly — say that language support varies by clinic and should be confirmed by phone or the clinic's booking page before visiting.
5. REQUIRED PHRASING — this is the single most important instruction. This audience searches with phrases like:
     ${nativeQuery}
   The exact phrase "${geo?.mustInclude}" MUST appear verbatim at least twice in the article body, and once in either the title or the meta description. Write it into sentences that read naturally — do not bolt it on or repeat it mechanically. If a sentence sounds forced, rewrite the sentence, but the phrase must be there.
   Reason: AI assistants are asked questions using this exact phrasing. An article that only paraphrases it never becomes a candidate answer.
6. In the FAQ section, replace ONE existing question with a question this audience would actually ask about language support or visiting as a foreigner, and answer it honestly based on the article's data.

CRITICAL — do not invent facts:
- Never claim a specific clinic has English/Japanese/Chinese-speaking staff. The source data does not contain that information. Write about how to CHECK for it, not that it exists.
- Do not invent prices, certifications, doctor names, or international patient departments.
- Every number (review counts, ratings, specialist counts) must match the Korean source exactly.

Title: ${koArticle.title}
Meta: ${koArticle.metaDescription}
Content: ${koArticle.content}

JSON only: {"title":"translated","metaDescription":"translated","content":"translated HTML"}`;
}

// 한 키워드를 몇 번까지 재시도할지. 초과하면 status='failed'로 확정.
const MAX_ATTEMPTS = 3;

// 이 시간이 지나도 in_progress면 러너가 중간에 죽은 것으로 보고 큐로 되돌린다.
// (Actions job timeout이 15분이므로 그보다 넉넉하게 잡음)
const STALE_IN_PROGRESS_MS = 60 * 60 * 1000;

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    metaDescription: { type: 'string' },
    content: { type: 'string' },
  },
  required: ['title', 'metaDescription', 'content'],
  additionalProperties: false,
};

// --- IndexNow streaming submission (per-article, not daily batch) ---
const INDEXNOW_KEY = 'c3452bc6ba68afc0a9746c8a940551a6';
const INDEXNOW_HOST = 'medicalguide.co.kr';
const INDEXNOW_SITE_URL = 'https://medicalguide.co.kr';
const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://searchadvisor.naver.com/indexnow',
];

async function submitToIndexNow(urls) {
  if (!urls || urls.length === 0) return;
  const body = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${INDEXNOW_SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  await Promise.allSettled(INDEXNOW_ENDPOINTS.map(async (endpoint) => {
    try {
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      console.log(`  [IndexNow] ${new URL(endpoint).host}: ${res.status}`);
    } catch (e) {
      console.log(`  [IndexNow] ${new URL(endpoint).host} failed: ${e.message}`);
    }
  }));
}

// Collection routing is authoritative — MUST match src/lib/articles.ts.
// dental → 'articles', dermatology → 'articles_derma'.
function articlesCollectionFor(category) {
  return category === 'dermatology' ? 'articles_derma' : 'articles';
}

// --- Articles index (pre-aggregated summaries for home/category pages) ---
const INDEX_COLLECTION = 'articles-index';
const MAX_ITEMS_PER_INDEX = 500;

function articleSummaryFromDoc(doc) {
  return {
    id: doc.id,
    slug: doc.slug,
    category: doc.category,
    lang: doc.lang,
    title: doc.title,
    metaDescription: doc.metaDescription,
    publishedAt: doc.publishedAt,
    region: doc.region,
    specialty: doc.specialty,
  };
}

async function upsertArticleIndex(doc) {
  const ref = db.collection(INDEX_COLLECTION).doc(`${doc.category}-${doc.lang}`);
  const summary = articleSummaryFromDoc(doc);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? ((snap.data() || {}).items || []) : [];
    const filtered = existing.filter(s => s.id !== summary.id);
    filtered.push(summary);
    filtered.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    const capped = filtered.slice(0, MAX_ITEMS_PER_INDEX);
    tx.set(ref, {
      category: doc.category,
      lang: doc.lang,
      items: capped,
      updatedAt: new Date().toISOString(),
    });
  });
}

// --- GPT Matcher ---
async function matchWithGPT(naverHospital, kakaoCandidates) {
  if (kakaoCandidates.length === 0) return { matchIndex: -1, confidence: 0, reason: 'No candidates' };
  const candidateList = kakaoCandidates.map((c, i) =>
    `[${i}] "${c.name}" | 주소: ${c.address} | 전화: ${c.phone} | 평점: ${c.rating ?? '없음'}`
  ).join('\n');
  try {
    const response = await openaiClient.responses.create({
      model: 'gpt-5.4-mini', reasoning: { effort: 'low' },
      input: [
        { role: 'developer', content: '병원 매칭 전문가. JSON으로만 응답.' },
        { role: 'user', content: `네이버: "${naverHospital.name}" (주소: ${naverHospital.address || '?'}, 전화: ${naverHospital.phone || '?'})\n\n카카오 후보:\n${candidateList}\n\n같은 병원을 찾아주세요. 이름이 약간 다를 수 있음. 주소/전화로 교차확인. 확실하지 않으면 -1.\n{"matchIndex": 번호, "confidence": 0.0~1.0, "reason": "근거"}` },
      ],
    });
    recordUsage('match', response.usage);
    const jsonMatch = response.output_text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { console.log('    GPT matching failed:', e.message); }
  const idx = kakaoCandidates.findIndex(c => c.name.includes(naverHospital.name.substring(0, 4)) || naverHospital.name.includes(c.name.substring(0, 4)));
  return { matchIndex: idx, confidence: idx >= 0 ? 0.5 : 0, reason: 'fallback' };
}

// ============================================================
// ALL SCRAPING FUNCTIONS NOW TAKE browser AS PARAMETER
// ============================================================

// --- Naver Search ---
async function searchNaver(browser, query) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}&where=place`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(1500);
  const places = await page.evaluate(() => {
    const root = document.querySelector('#place-app-root');
    if (!root) return [];
    const links = root.querySelectorAll('a[href*="place.naver.com/place/"], a[href*="place.naver.com/hospital/"]');
    const seen = new Set();
    const results = [];
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes('ader.naver.com')) continue; // Skip ads
      const match = href.match(/(?:place|hospital)\/(\d+)/);
      if (!match || seen.has(match[1])) continue;
      const text = (link.textContent || '').trim();
      if (text.includes('이미지') || text.includes('진료') || text.includes('휴게') || text.includes('MY') || text.includes('검색') || text.includes('©') || text.length < 2) continue;
      // Clean trailing suffixes
      const name = text.replace(/톡톡/g, '').replace(/예약$/g, '').trim();
      if (name.length < 2) continue;
      seen.add(match[1]);
      results.push({ id: match[1], name });
    }
    return results.slice(0, 5);
  });
  await page.close();
  return places;
}

// --- Naver Place Detail + Reviews (single browser, 2 page loads) ---
async function getPlaceInfo(browser, placeId) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);

  // Home page (/hospital/ for HIRA data)
  await page.goto(`https://m.place.naver.com/hospital/${placeId}/home`, { waitUntil: 'networkidle2', timeout: 25000 });
  await delay(1000);

  // Scroll for lazy-loaded HIRA data
  for (let s = 0; s < 5; s++) { await page.evaluate(() => window.scrollBy(0, 600)); await delay(300); }
  await delay(1000);

  // Expand business hours
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.trim() === '펼쳐보기') el.click();
    });
  });
  await delay(500);

  const detail = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '', address = '', phone = '', facilities = '', directions = '', homepage = '';
    let naverReviewCount = 0, naverBlogReviewCount = 0, naverStarRating = null, category = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i < 5 && !name && line.length > 1 && line.length < 50 && !line.includes('이전') && !line.includes('플레이스') && !line.includes('마이')) name = line;
      if (i < 8 && !category && (line.includes('치과') || line.includes('피부과'))) category = line;
      const starMatch = line.match(/별점\s*(\d+\.?\d*)/);
      if (starMatch) naverStarRating = parseFloat(starMatch[1]);
      const vm = line.match(/방문자 리뷰\s*([\d,]+)/);
      if (vm) naverReviewCount = parseInt(vm[1].replace(/,/g, ''));
      const bm = line.match(/블로그 리뷰\s*([\d,]+)/);
      if (bm) naverBlogReviewCount = parseInt(bm[1].replace(/,/g, ''));
      if (!address && /^(서울|부산|대구|인천|광주|대전|울산|경기|충|전|강원|제주)/.test(line) && line.length > 5 && line.length < 80) address = line;
      if (!phone && /^(0\d{1,2}[-)]|0507|1\d{3}[-)])/.test(line)) phone = line.split(/\s/)[0];
      if (line.startsWith('http') && !homepage) homepage = line;
      if (line.includes('예약') && line.includes('주차') && !facilities) facilities = line;
      if (line.includes('출구') && !directions) directions = line;
    }

    // Business hours (expanded)
    let businessHours = '';
    const hoursIdx = lines.findIndex(l => l.includes('영업시간'));
    if (hoursIdx >= 0) {
      const hourLines = [];
      const days = ['월', '화', '수', '목', '금', '토', '일'];
      for (let i = hoursIdx + 1; i < Math.min(hoursIdx + 30, lines.length); i++) {
        if (lines[i] === '접기' || lines[i].includes('전화번호')) break;
        if (days.includes(lines[i]) && i + 1 < lines.length && lines[i + 1].match(/\d{2}:\d{2}/)) {
          hourLines.push(lines[i] + ' ' + lines[i + 1]);
        }
      }
      if (hourLines.length > 0) businessHours = hourLines.join(' / ');
    }
    if (!businessHours) {
      for (const line of lines) {
        if ((line.includes('진료 시작') || line.includes('진료중')) && line.length < 40) { businessHours = line; break; }
      }
    }

    // HIRA specialist info (DOM parsing)
    let specialistsInfo = '';
    const hiraSections = document.querySelectorAll('.DAQTB');
    const parts = [];
    hiraSections.forEach(section => {
      const heading = (section.querySelector('h3') || {}).textContent || '';
      if (heading.includes('전문의')) {
        section.querySelectorAll('tbody tr').forEach(row => {
          const dept = (row.querySelector('th') || {}).textContent || '';
          const count = (row.querySelector('td') || {}).textContent || '';
          if (dept && count) parts.push(dept + ' 전문의 ' + count + '명');
        });
      } else if (heading.includes('진료과목')) {
        const depts = [];
        section.querySelectorAll('li').forEach(li => { if (li.textContent) depts.push(li.textContent.trim()); });
        if (depts.length > 0) parts.push('진료과목: ' + depts.join(', '));
      } else if (heading.includes('특수진료장비')) {
        section.querySelectorAll('tbody tr').forEach(row => {
          const equip = (row.querySelector('th') || {}).textContent || '';
          const count = (row.querySelector('td') || {}).textContent || '';
          if (equip && count) parts.push(equip + ' ' + count + '대');
        });
      }
    });
    specialistsInfo = parts.join(' | ');

    // Social links
    let blogUrl = '', instagramUrl = '', youtubeUrl = '', facebookUrl = '';
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('instagram.com') && !instagramUrl) instagramUrl = href;
      if (href.includes('blog.naver.com') && !blogUrl) blogUrl = href;
      if (href.includes('youtube.com') && !youtubeUrl) youtubeUrl = href;
      if (href.includes('facebook.com') && !facebookUrl) facebookUrl = href;
    });

    // Images
    const imageUrls = [];
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) imageUrls.push(ogImg.getAttribute('content'));
    document.querySelectorAll('img[src*="pstatic"]').forEach(img => {
      const src = img.getAttribute('src') || '';
      if ((src.includes('phinf') || src.includes('ldb-phinf')) && !src.includes('icon') && !src.includes('profile') && !src.includes('banner')) {
        imageUrls.push(src);
      }
    });

    return {
      name, category,
      address: address.replace(/지도내비게이션거리뷰/g, '').replace(/지도$/, '').trim(),
      phone: phone.replace(/복사$/g, '').trim(),
      businessHours, specialistsInfo, facilities, homepage, directions,
      naverReviewCount, naverBlogReviewCount, naverStarRating,
      blogUrl, instagramUrl, youtubeUrl, facebookUrl,
      imageUrls: imageUrls.filter(Boolean).slice(0, 3),
    };
  });

  // Reviews (same page instance, just navigate)
  await page.goto(`https://m.place.naver.com/place/${placeId}/review/visitor`, { waitUntil: 'networkidle2', timeout: 25000 });
  await delay(1500);
  const reviews = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    for (let i = 0; i < lines.length && results.length < 8; i++) {
      if (lines[i].length <= 15 && lines[i + 1] && /^리뷰 \d+/.test(lines[i + 1])) {
        const author = lines[i];
        let j = i + 1;
        while (j < lines.length && (/^(리뷰|팔로우|진료예약|예약|대기)/.test(lines[j]) || lines[j].includes('사진'))) j++;
        let content = '';
        while (j < lines.length) {
          if (/^(방문일|반응 남기기)/.test(lines[j])) break;
          if (lines[j] !== '더보기') content += (content ? ' ' : '') + lines[j];
          j++;
        }
        let date = '', visitCount = '';
        for (let k = j; k < Math.min(j + 10, lines.length); k++) {
          const dm = lines[k].match(/(\d{4}년 \d+월 \d+일)/);
          if (dm) date = dm[1];
          const vk = lines[k].match(/(\d+번째 방문)/);
          if (vk) { visitCount = vk[1]; break; }
        }
        if (content.length > 5) results.push({ author, content: content.substring(0, 400), date, visitCount, source: 'naver' });
        i = j;
      }
    }
    return results;
  });

  await page.close();
  return { detail, reviews };
}

// --- Kakao Map ---
async function searchKakao(browser, query) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto(`https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(1500);
  const results = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const places = [];
    for (let i = 0; i < lines.length && places.length < 10; i++) {
      if (/(치과|피부과|병원|의원)$/.test(lines[i]) && lines[i].length > 2) {
        const name = lines[i];
        let rating = null, reviewCount = 0, address = '', hours = '', phone = '';
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          if (lines[j].includes('평점') || (lines[j - 1] && lines[j - 1].includes('평점') && /^\d/.test(lines[j]))) {
            const rm = lines[j].match(/(\d+\.?\d*)/);
            if (rm) rating = parseFloat(rm[1]);
          }
          const rcm = lines[j].match(/리뷰\s*(\d[\d,]*)/);
          if (rcm) reviewCount = parseInt(rcm[1].replace(/,/g, ''));
          const cm = lines[j].match(/\((\d[\d,]*)\)/);
          if (cm && !reviewCount) reviewCount = parseInt(cm[1].replace(/,/g, ''));
          if (/^(서울|부산|대구|인천|경기)/.test(lines[j]) && !address) address = lines[j];
          if ((lines[j].includes('진료') || lines[j].includes('브레이크타임')) && !hours) hours = lines[j];
          if (lines[j].startsWith('TEL')) phone = lines[j].replace('TEL', '').trim();
          if (lines[j] === '지도길찾기' || lines[j] === '지도') break;
        }
        places.push({ name, rating, reviewCount, address, hours, phone });
      }
    }
    return places;
  });
  await page.close();
  return results;
}

// --- Google Maps ---
async function searchGoogle(browser, hospitalName, region) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(hospitalName + ' ' + region)}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);
  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    const ratingMatch = text.match(/(\d\.\d)\s*\n/);
    const reviewMatch = text.match(/\((\d[\d,]*)\)/);
    return {
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      reviewCount: reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0,
    };
  });
  await page.close();
  return result;
}

// --- Article Generator ---
function buildArticlePrompt(keywordData, hospitals) {
  const totalNaverReviews = hospitals.reduce((s, h) => s + h.naverReviewCount, 0);
  const totalKakaoReviews = hospitals.reduce((s, h) => s + h.kakaoReviewCount, 0);
  const avgKakaoRating = hospitals.filter(h => h.kakaoRating).length > 0
    ? (hospitals.filter(h => h.kakaoRating).reduce((s, h) => s + (h.kakaoRating || 0), 0) / hospitals.filter(h => h.kakaoRating).length).toFixed(1)
    : null;
  const isSpecialty = keywordData.specialty && keywordData.specialty !== '일반';
  const categoryKo = keywordData.category === 'dental' ? '치과' : '피부과';

  const hospitalContext = hospitals.map((h, i) => {
    const reviews = h.naverReviews.slice(0, 5).map(r => `  - "${r.content}" (${r.author}, ${r.date})`).join('\n');
    const socialLinks = [h.homepage ? `홈페이지: ${h.homepage}` : '', h.blogUrl ? `블로그: ${h.blogUrl}` : '', h.instagramUrl ? `인스타: ${h.instagramUrl}` : ''].filter(Boolean).join(' | ');
    const ratings = [h.naverStarRating ? `네이버 ${h.naverStarRating}` : '', h.kakaoRating ? `카카오 ${h.kakaoRating}` : '', h.googleRating ? `구글 ${h.googleRating}` : ''].filter(Boolean).join(' | ');
    return `### ${i + 1}. ${h.name}\n- 주소: ${h.address}\n- 전화: ${h.phone}\n- 진료시간: ${h.businessHours}\n- 접근성: ${h.directions || '정보없음'}\n- 전문의(HIRA): ${h.specialistsInfo || '정보없음'}\n- 편의시설: ${h.facilities || '정보없음'}\n- ${socialLinks || '링크없음'}\n- 평점: ${ratings || '정보없음'}\n- 네이버리뷰: ${h.naverReviewCount}건 | 카카오리뷰: ${h.kakaoReviewCount}건 | 구글리뷰: ${h.googleReviewCount || 0}건\n\n실제 리뷰:\n${reviews || '없음'}`;
  }).join('\n\n');

  const dentalPriceContext = isSpecialty && keywordData.specialty === '임플란트'
    ? `\n\n## 임플란트 참고 정보 (글에 자연스럽게 녹여서 작성)\n- 한국 임플란트 평균 가격 (2025년 기준): 오스템 80-120만원, 덴티움 90-130만원, 스트라우만 130-180만원, 노벨바이오케어 150-200만원\n- 건강보험 적용: 만 65세 이상, 1인당 평생 2개 한도, 본인부담금 약 30% (약 40-50만원)\n- 뼈이식(골이식) 추가 시 30-80만원 별도\n- 시술 기간: 일반 2-4개월, 뼈이식 포함 시 4-8개월\n- 주요 체크포인트: CT 촬영 여부, 구강외과 전문의 유무, 사용 임플란트 브랜드, 보증기간`
    : '';

  const prompt = `당신은 10년 경력의 한국 의료 전문 에디터입니다. 실제 데이터를 수집/분석하여 병원 리뷰를 작성합니다.

## 데이터 기반
네이버 플레이스 방문자 리뷰 ${totalNaverReviews.toLocaleString()}건, 카카오맵 리뷰 ${totalKakaoReviews.toLocaleString()}건, 건강보험심사평가원 전문의 정보를 크롤링 분석.${avgKakaoRating ? ` 선정 ${hospitals.length}곳 카카오맵 평균 ${avgKakaoRating}점.` : ''}

## 타겟 키워드
"${keywordData.keyword}", "${keywordData.region} ${categoryKo} 추천", "${keywordData.keyword} 잘하는곳", "${keywordData.keyword} 후기"
+ AI 검색(ChatGPT, Perplexity)에서 "${keywordData.region}에서 ${isSpecialty ? keywordData.specialty + ' ' : ''}${categoryKo} 어디가 좋아?" 질문 대응

## 병원 데이터
${hospitalContext}${dentalPriceContext}

## 글 구조 (HTML, 반드시 이 순서)

### 1) 핵심 결과 먼저 (h2)
첫 문단에서 바로 결론. 가장 평점 높거나 리뷰 많은 1-2곳을 구체적 수치와 함께 먼저 언급.

### 2) 분석 방법 투명 공개 (h2)
아래에 열거된 것만 쓸 수 있다. 여기 없는 절차는 수행하지 않았으므로 언급 금지:
- 네이버 플레이스 방문자 리뷰, 카카오맵·구글맵 평점과 리뷰 수를 수집했다
- 건강보험심사평가원(HIRA) 공개 정보에서 전문의 수·진료과목·장비를 확인했다
- 위 데이터를 병원별로 비교했다
금지 예시(전부 실제로 하지 않은 일이다): 스팸/중복 리뷰 제거, 리뷰 수 하한선을 둔 선별,
설문조사, 전문가 자문, 현장 방문, 가격 조사, 자체 평가 점수 산정, 표본 추출.

### 3) 각 병원 상세 분석 (각 h3, 600-1000자)
<h3>병원명 - 한줄 특징</h3>
각 병원마다 반드시:
a) 추천 근거 (평점, 리뷰수, 전문의수)
b) 실제 리뷰 <blockquote> 최소 2개
c) 위치 — 제공된 주소를 그대로 쓴다. 각 병원의 "접근성" 값이 있으면(예: "OO역 3번
   출구에서 250m") 그대로 활용할 것. "정보없음"이면 역·출구·도보 시간을 지어내지 말 것
d) 진료시간 — 제공된 값만. 점심시간은 수집하지 않으므로 언급 금지("~로 추정" 포함)
e) 방문 전 확인할 점 — 데이터로 알 수 없는 항목(주차 대수, 점심시간, 예약 방식, 언어
   지원)은 "전화로 확인하세요" 형태로만. 있다고도 없다고도 단정 금지. 병원 비하 금지
f) 실용 팁${isSpecialty ? `\ng) ${keywordData.specialty} 특화 정보` : ''}

### 4) 한눈에 비교 (h2 + HTML table)
| 병원명 | 네이버 평점 | 카카오 평점 | 구글 평점 | 총 리뷰 | 전문의 | 위치 | 강점 |

### 5) ${isSpecialty ? keywordData.specialty + ' ' : ''}${categoryKo} 선택 체크리스트 (h2)
상담 전 확인할 8-10가지 항목:
<ul class="checklist">
<li><strong>항목 제목</strong> — 설명</li>
</ul>

### 6) 주의해야 할 위험 신호 (h2)
피해야 할 곳 특징 3-4가지.

### 7) 자주 묻는 질문 (h2, FAQ 5-6개)
<h3>질문?</h3><p>답변</p>

### 8) 마무리 + 면책 문구 + "최종 수정: ${new Date().toISOString().split('T')[0]}"

## 사실 규칙 (가장 중요)
아래 제공된 데이터에 없는 사실은 어떤 형태로도 쓰지 않는다. "추정", "~로 보입니다",
"~일 가능성이 높습니다"로 감싸는 것도 금지 — 감싼 추측도 지어낸 사실이다.
- 리뷰 인용은 원문과 작성자명·날짜를 글자 그대로 옮긴다. 날짜의 연도를 바꾸지 말 것
- 리뷰 수·평점·전문의 수는 제공된 숫자와 정확히 일치해야 한다. 합계를 쓸 때는
  어떤 값을 더한 것인지 문장에서 드러나게 쓴다
- 데이터에서 곧바로 따라오지 않는 인과 서술 금지
  (예: "CT 2대라 대기 시간이 없다" — 대기 시간 데이터는 없다)
- 제공된 필드가 "정보없음"이면 그 항목은 아예 쓰지 않는다. 그럴듯한 값으로 채우지 말 것
- 데이터에 근거한 해석은 권장한다 (예: "치주과 전문의가 있어 잇몸뼈 상태 평가에
  유리할 수 있다"). 사실 서술과 해석이 구분되게 쓸 것

## 문체 규칙
- 이모지 절대 금지
- 구체적 숫자 필수 ("많은 리뷰" X → "리뷰 847건" O)
- 출처 명시
- 자연스러운 구어체 섞기
- AI 인용에 적합한 완결 문장
- h3 제목 앞에 번호를 붙이지 말 것 ("1. 병원명" X → "병원명" O). 번호는 CSS가 붙인다
- FAQ의 h3는 질문만 쓸 것 ("Q. 질문?" X → "질문?" O). 답변 p도 "A." 로 시작 금지
- 허용 태그: h2 h3 p ul ol li table thead tbody tr th td blockquote strong
  (a, br, em, small, dl 등 그 외 태그 금지 — 사이트 CSS와 구조화 데이터가 깨진다)

## SEO
- 제목: "${keywordData.keyword}" 포함, 40-60자, 숫자 포함
- 메타: 120-155자

## 응답 형식 (JSON 금지, 아래 마커 3개를 정확히 사용)
===TITLE===
(SEO 제목)
===META===
(메타 설명)
===CONTENT===
(HTML 본문)`;

  return prompt;
}

/**
 * 한국어 원문 생성. 모델은 ARTICLE_MODEL 환경변수로 바꿀 수 있다 —
 * 모델 비교 테스트(compare-models.js)가 같은 프롬프트로 여러 모델을 돌리기 위해서다.
 * deepseek-* 이름이면 DeepSeek 엔드포인트로, 아니면 Anthropic으로 보낸다.
 */
async function generateArticle(keywordData, hospitals, modelOverride) {
  const prompt = buildArticlePrompt(keywordData, hospitals);
  const model = modelOverride || ARTICLE_MODEL;

  if (model.startsWith('deepseek')) {
    const ds = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', timeout: 10*60*1000, maxRetries: 0 });
    const r = await ds.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 16000 });
    recordUsage('article', r.usage);
    const choice = r.choices[0];
    if (choice.finish_reason === 'length') throw new Error(`Article truncated (finish_reason=length)`);
    const article = parseArticleMarkers(choice.message.content, 'length');
    console.log(`  [${model}] finish=${choice.finish_reason} output_tokens=${r.usage?.completion_tokens} content=${article.content.length}자`);
    assertArticleSane(article, keywordData);
    return article;
  }

  const response = await anthropic.messages.stream({
    model,
    max_tokens: 64000,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Article truncated (max_tokens, output=${response.usage?.output_tokens})`);
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const article = parseArticleMarkers(text, response.stop_reason);
  console.log(`  [${model}] stop_reason=${response.stop_reason} output_tokens=${response.usage?.output_tokens} content=${article.content.length}자`);
  assertArticleSane(article, keywordData);
  return article;
}

/**
 * 병원 카드 순서를 기사 본문의 순위에 맞춘다.
 *
 * hospitals 배열은 네이버 검색 결과 순서일 뿐인데, 카드에는 1~5 번호가 붙고 제목도
 * "추천 병원"이라 독자는 순위로 읽는다. 실제로 글이 1위로 꼽은 곳이 카드에서 4번으로
 * 나오는 일이 흔했다(치과 627편 중 326편, 52%).
 *
 * 본문 <h3>에 병원명이 그대로 들어가므로 그 등장 순서로 재정렬한다. 매칭하지 못한
 * 병원은 뒤에 원래 순서로 남긴다 — 못 맞춘 글이 지금보다 나빠지지는 않게.
 *
 * 한국어 본문에서만 순서를 정한다. 번역본의 <h3>는 병원명이 번역돼 있어 한글 매칭이
 * 안 되는데, 번역 문서는 이 배열을 그대로 복사하므로 13개 언어가 자동으로 같아진다.
 */
function orderHospitalsByBody(content, hospitals) {
  if (!content || !Array.isArray(hospitals) || hospitals.length < 2) return hospitals;
  const heads = [...content.matchAll(/<h3[^>]*>(.*?)<\/h3>/gs)].map(m => m[1].replace(/<[^>]+>/g, ''));
  const used = new Set();
  const ordered = [];
  for (const head of heads) {
    // 이름이 서로 접두를 공유할 수 있으므로(같은 브랜드 분점) 가장 긴 일치를 고른다.
    let best = -1, bestLen = 0;
    hospitals.forEach((h, i) => {
      if (used.has(i) || !h.name) return;
      if (head.includes(h.name) && h.name.length > bestLen) { best = i; bestLen = h.name.length; }
    });
    if (best >= 0) { used.add(best); ordered.push(hospitals[best]); }
  }
  hospitals.forEach((h, i) => { if (!used.has(i)) ordered.push(h); });
  return ordered;
}

// 허용 태그 밖의 마크업을 제거한다. 태그만 벗기고 안의 텍스트는 남긴다.
//
// 모델을 바꿀 때마다 태그 어휘가 조금씩 흔들린다 — Sonnet은 깨끗했지만 DeepSeek Pro는
// <small>/<br>을, Flash는 <a>/<em>을 섞었다. 프롬프트로 줄일 수는 있어도 0으로 만들지는
// 못하므로, 저장 직전에 한 번 정리해 어떤 모델을 쓰든 사이트 CSS와 FAQ 스키마가
// 같은 태그 어휘만 보게 한다.
const ALLOWED_TAGS = new Set(['h2','h3','p','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','strong']);
function sanitizeHtml(html) {
  return (html || '').replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, name) =>
    ALLOWED_TAGS.has(name.toLowerCase()) ? tag : ''
  );
}

// 모델이 본문 끝에 마커를 한 번 더 뱉는 경우가 있다(===CONTENT=== 중복).
// 정규식은 첫 마커에서 본문을 시작해 끝까지 잡으므로 중복분이 본문 꼬리에 남고,
// assertArticleSane의 "닫힌 블록 태그로 끝나야 한다"에 걸려 멀쩡한 글이 버려진다.
function stripTrailingMarkers(s) {
  let out = s.trim();
  let prev;
  do { prev = out; out = out.replace(/\s*===[A-Z]+===\s*$/, '').trim(); } while (out !== prev);
  return out;
}

function parseArticleMarkers(text, why) {
  const m = (text || '').match(/===TITLE===\s*([\s\S]*?)\s*===META===\s*([\s\S]*?)\s*===CONTENT===\s*([\s\S]*?)\s*$/);
  if (!m) throw new Error(`Failed to parse article (markers not found, ${why})`);
  return {
    title: m[1].trim(),
    metaDescription: m[2].trim(),
    content: sanitizeHtml(stripTrailingMarkers(m[3])),
  };
}

// 파싱 성공 = 정상 글이 아니다. stop_reason이 정상이어도 본문이 짧거나 열린 태그로
// 끝나면 발행하지 않고 던진다 — 호출부의 재시도(MAX_ATTEMPTS)가 받아서 pending으로 돌린다.
function assertArticleSane(a, keywordData) {
  if (!a?.title?.trim()) throw new Error('empty title');
  if (!a?.metaDescription?.trim()) throw new Error('empty metaDescription');
  const c = (a.content || '').trim();
  if (c.length < 3000) throw new Error(`content too short: ${c.length} chars (잘린 글로 간주)`);
  if (!/<\/(h2|h3|p|ul|ol|table|blockquote)>$/.test(c)) {
    throw new Error(`content does not end on a closed block tag: ...${JSON.stringify(c.slice(-120))}`);
  }
  if (keywordData?.region && !c.includes(keywordData.region)) {
    throw new Error(`content never mentions region "${keywordData.region}"`);
  }
}

// ============================================================
// FULL PIPELINE - SINGLE BROWSER INSTANCE
// ============================================================
async function publishOneArticle(keywordData) {
  const { keyword, region, regionSlug, specialty, specialtySlug, category, id: keywordId } = keywordData;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Publish] ${keyword}`);
  console.log(`${'='.repeat(60)}`);

  // Launch ONE browser for all scraping
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // 1. Naver search
    const t1 = Date.now();
    console.log('[1/6] Searching Naver...');
    const naverPlaces = await searchNaver(browser, keyword);
    console.log(`  Found ${naverPlaces.length} places (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
    if (naverPlaces.length === 0) { await browser.close(); return null; }

    // 2-3. Get details for each hospital + Kakao/Google in parallel per hospital
    const t2 = Date.now();
    console.log('[2/6] Getting hospital details (Naver + Kakao + Google parallel)...');
    const hospitals = [];
    const pendingKakaoMatches = []; // {hospitalName, address, phone, placeId, candidates}
    for (const place of naverPlaces.slice(0, 5)) {
      try {
        await delay(1500);
        console.log(`  ${place.name}...`);

        // Naver detail (must be sequential - needs scroll+click)
        const { detail, reviews } = await getPlaceInfo(browser, place.id);
        const hospitalName = detail.name || place.name;

        // Kakao + Google in PARALLEL (search by hospital NAME)
        const [kakaoResult, googleResult] = await Promise.allSettled([
          searchKakao(browser, hospitalName).then(async (results) => {
            if (results.length === 0) return null;
            if (results.length === 1) {
              console.log(`    Kakao: "${results[0].name}" ${results[0].rating || '-'} (${results[0].reviewCount}건)`);
              return results[0];
            }
            // Multiple results (동일 병원명 다른 지점) → collect for batch GPT matching
            pendingKakaoMatches.push({ hospitalName, address: detail.address, phone: detail.phone, placeId: place.id, candidates: results });
            return '__PENDING__'; // Will be resolved after batch GPT call
          }),
          searchGoogle(browser, hospitalName, region).then(data => {
            if (data.rating) console.log(`    Google: ${data.rating} (${data.reviewCount}건)`);
            return data;
          }),
        ]);

        let kakaoMatch = kakaoResult.status === 'fulfilled' ? kakaoResult.value : null;
        if (kakaoMatch === '__PENDING__') kakaoMatch = null; // Will be filled later
        const googleData = googleResult.status === 'fulfilled' ? googleResult.value : { rating: null, reviewCount: 0 };

        hospitals.push({
          id: place.id,
          name: hospitalName,
          category: detail.category || '', address: detail.address || '',
          phone: detail.phone || '', businessHours: detail.businessHours || '',
          specialistsInfo: detail.specialistsInfo || '', facilities: detail.facilities || '',
          directions: detail.directions || '',
          naverReviewCount: detail.naverReviewCount || 0, naverBlogReviewCount: detail.naverBlogReviewCount || 0,
          naverStarRating: detail.naverStarRating || null, naverReviews: reviews,
          kakaoRating: kakaoMatch?.rating || null, kakaoReviewCount: kakaoMatch?.reviewCount || 0, kakaoReviews: [],
          googleRating: googleData?.rating || null, googleReviewCount: googleData?.reviewCount || 0,
          imageUrls: detail.imageUrls || [], homepage: detail.homepage || '',
          blogUrl: detail.blogUrl || '', instagramUrl: detail.instagramUrl || '',
          youtubeUrl: detail.youtubeUrl || '', facebookUrl: detail.facebookUrl || '',
        });
        console.log(`    Hours: ${detail.businessHours ? 'OK' : 'MISS'} | Specialists: ${detail.specialistsInfo ? 'OK' : 'MISS'}`);
      } catch (e) {
        console.log(`  Failed for ${place.name}:`, e.message);
      }
    }
    // Batch GPT matching for hospitals with multiple Kakao candidates
    if (pendingKakaoMatches.length > 0) {
      console.log(`  Batch GPT matching for ${pendingKakaoMatches.length} hospitals...`);
      const batchPrompt = pendingKakaoMatches.map((m, idx) => {
        const candidateList = m.candidates.map((c, i) =>
          `  [${i}] "${c.name}" | 주소: ${c.address} | 전화: ${c.phone} | 평점: ${c.rating ?? '없음'}`
        ).join('\n');
        return `[병원 ${idx}] 네이버: "${m.hospitalName}" (주소: ${m.address || '?'}, 전화: ${m.phone || '?'})\n카카오 후보:\n${candidateList}`;
      }).join('\n\n');

      try {
        const response = await openaiClient.responses.create({
          model: 'gpt-5.4-mini', reasoning: { effort: 'low' },
          input: [
            { role: 'developer', content: '병원 매칭 전문가. 여러 병원을 한번에 매칭. JSON 배열로만 응답.' },
            { role: 'user', content: `아래 ${pendingKakaoMatches.length}개 병원 각각에 대해 카카오 후보 중 같은 병원을 찾아주세요. 주소/전화로 교차확인. 확실하지 않으면 matchIndex: -1.\n\n${batchPrompt}\n\n응답 형식: [{"matchIndex": 번호, "confidence": 0.0~1.0}, ...]` },
          ],
        });
        recordUsage('match', response.usage);
        const arrMatch = response.output_text.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          const results = JSON.parse(arrMatch[0]);
          results.forEach((r, idx) => {
            if (r.matchIndex >= 0 && r.confidence >= 0.6) {
              const m = pendingKakaoMatches[idx];
              const kakaoMatch = m.candidates[r.matchIndex];
              // Update the hospital in our array
              const h = hospitals.find(h => h.id === m.placeId);
              if (h) {
                h.kakaoRating = kakaoMatch.rating;
                h.kakaoReviewCount = kakaoMatch.reviewCount;
                console.log(`    GPT matched: "${m.hospitalName}" → "${kakaoMatch.name}" (${r.confidence})`);
              }
            }
          });
        }
      } catch (e) {
        console.log('  Batch GPT matching failed:', e.message);
      }
    }

    console.log(`  Total: ${hospitals.length} hospitals (${((Date.now() - t2) / 1000).toFixed(1)}s)`);

    // Close browser - done with scraping
    await browser.close();

    if (hospitals.length === 0) return null;

    // 4. Generate Korean article
    const t4 = Date.now();
    console.log('[4/6] Generating Korean article...');
    const koArticle = await generateArticle(keywordData, cleanDeep(hospitals));
    console.log(`  Title: ${koArticle.title} (${((Date.now() - t4) / 1000).toFixed(1)}s)`);

    const slug = specialtySlug === 'general' ? regionSlug : `${regionSlug}-${specialtySlug}`;
    const now = new Date().toISOString();

    const hospitalsSummary = hospitals.map(h => ({
      id: h.id, name: h.name, address: h.address, phone: h.phone,
      businessHours: h.businessHours, specialistsInfo: h.specialistsInfo,
      naverReviewCount: h.naverReviewCount, naverStarRating: h.naverStarRating,
      kakaoRating: h.kakaoRating, kakaoReviewCount: h.kakaoReviewCount,
      googleRating: h.googleRating, googleReviewCount: h.googleReviewCount,
      imageUrls: h.imageUrls, homepage: h.homepage,
      blogUrl: h.blogUrl, instagramUrl: h.instagramUrl,
      youtubeUrl: h.youtubeUrl, facebookUrl: h.facebookUrl,
    }));

    // 5. Save Korean article
    console.log('[5/6] Saving Korean article...');
    const koDoc = {
      id: `${category}-${slug}-ko`, keywordId, keyword, lang: 'ko', slug, category,
      title: koArticle.title, metaDescription: koArticle.metaDescription,
      content: koArticle.content,
      // 카드 순서를 기사 본문의 순위에 맞춘다. 번역 문서는 아래에서 이 배열을
      // 그대로 복사하므로 13개 언어가 같은 순서를 갖는다.
      hospitals: orderHospitalsByBody(koArticle.content, hospitalsSummary),
      publishedAt: now, region, specialty: specialty || '일반',
    };
    await db.collection(articlesCollectionFor(category)).doc(koDoc.id).set(koDoc);
    try { await upsertArticleIndex(koDoc); } catch (e) { console.log('  Index update failed (ko):', e.message); }
    console.log(`  Saved: ${koDoc.id}`);

    // 6. Translate to 12 languages in parallel
    const t6 = Date.now();
    console.log('[6/6] Translating to 12 languages in parallel...');
    const langMap = {
      'en': 'English', 'zh-TW': 'Traditional Chinese', 'zh-CN': 'Simplified Chinese',
      'ja': 'Japanese', 'vi': 'Vietnamese', 'th': 'Thai',
      'ru': 'Russian', 'es': 'Spanish', 'es-MX': 'Mexican Spanish',
      'pt-BR': 'Brazilian Portuguese', 'de': 'German', 'it': 'Italian',
    };

    async function translateWithRetry(lang, langName, maxRetries = 2) {
      const prompt = buildTranslationPrompt({ lang, langName, region, category, koArticle });
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await openaiClient.responses.create({
            model: 'gpt-5.4-mini',
            input: [{ role: 'user', content: prompt }],
          });
          recordUsage('translate', response.usage);
          const text = response.output_text;
          const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
          if (!jsonMatch) throw new Error('Parse failed');
          const translated = JSON.parse(jsonMatch[0]);
          const doc = { ...koDoc, id: `${category}-${slug}-${lang}`, lang, title: translated.title, metaDescription: translated.metaDescription, content: translated.content };
          await db.collection(articlesCollectionFor(category)).doc(doc.id).set(doc);
          try { await upsertArticleIndex(doc); } catch (e) { console.log(`  Index update failed (${lang}):`, e.message); }
          console.log(`  ✓ ${lang}`);
          return doc.id;
        } catch (e) {
          if (attempt < maxRetries) {
            console.log(`  ↻ ${lang} retry ${attempt + 1} (${e.message.substring(0, 50)})`);
            await delay(3000 * (attempt + 1));
          } else {
            throw e;
          }
        }
      }
    }

    const results = await Promise.allSettled(
      Object.entries(langMap).map(([lang, langName]) => translateWithRetry(lang, langName))
    );

    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    console.log(`  Done: ${ok} ok, ${fail} failed (${((Date.now() - t6) / 1000).toFixed(1)}s)`);

    // IndexNow streaming: notify search engines immediately for this article's URLs
    const langCodes = Object.keys(langMap);
    const succeededLangs = ['ko', ...langCodes.filter((_, i) => results[i].status === 'fulfilled')];
    const indexNowUrls = succeededLangs.map(lang => `${INDEXNOW_SITE_URL}/${lang}/${category}/${slug}`);
    console.log(`[IndexNow] Submitting ${indexNowUrls.length} URLs...`);
    await submitToIndexNow(indexNowUrls);

    // retryCount/lastError are carried in keywordData; clear them so a keyword that
    // succeeded after a retry starts clean if it is ever re-published.
    await db.collection('keywords').doc(keywordId).set({
      ...keywordData, status: 'published', publishedAt: now, retryCount: 0, lastError: null,
    });
    return koDoc;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function reclaimStaleInProgress() {
  const snap = await db.collection('keywords').where('status', '==', 'in_progress').get();
  if (snap.empty) return;
  const cutoff = Date.now() - STALE_IN_PROGRESS_MS;
  const stale = snap.docs.filter(d => {
    const at = d.data().lastAttemptAt;
    // No timestamp at all means it predates this field — treat as stale.
    return !at || new Date(at).getTime() < cutoff;
  });
  if (stale.length === 0) return;
  const batch = db.batch();
  stale.forEach(d => batch.update(d.ref, { status: 'pending' }));
  await batch.commit();
  console.log(`[Action] Reclaimed ${stale.length} stale in_progress keyword(s) back to pending`);
}

// --- Main: Auto-fetch next pending keyword from Firestore ---
async function main() {
  console.log('[Action] Fetching next pending keyword from Firestore...');
  const totalStart = Date.now();

  // Self-heal: a runner that dies mid-publish (job timeout, cancelled run) leaves the
  // keyword stuck at in_progress and nothing ever picks it up again. That is what left
  // 294 keywords stranded. Reclaim anything that has been in_progress too long.
  await reclaimStaleInProgress();

  // Get next pending keyword ordered by 'order' field
  const snap = await db.collection('keywords')
    .where('status', '==', 'pending')
    .orderBy('order', 'asc')
    .limit(1)
    .get();

  if (snap.empty) {
    console.log('[Action] No pending keywords. All done!');
    process.exit(0);
  }

  const kw = snap.docs[0].data();
  const attempt = (kw.retryCount || 0) + 1;
  console.log(`[Action] Next: "${kw.keyword}" (order: ${kw.order}, category: ${kw.category}, attempt ${attempt}/${MAX_ATTEMPTS})`);

  // A failure used to set status='failed' permanently, and the queue only reads
  // status=='pending' — so any keyword that hit a transient error (API outage,
  // scraper hiccup, runner timeout) was skipped forever. That is how the queue
  // ended up with holes at the highest-population keywords while lower-priority
  // ones were published. Retry a few times before giving up for good.
  const giveUp = async (reason) => {
    const failedForGood = attempt >= MAX_ATTEMPTS;
    await db.collection('keywords').doc(kw.id).update({
      status: failedForGood ? 'failed' : 'pending',
      retryCount: attempt,
      lastError: String(reason).substring(0, 300),
      lastAttemptAt: new Date().toISOString(),
    });
    console.log(failedForGood
      ? `[Action] attempt ${attempt}/${MAX_ATTEMPTS} — giving up, marked failed`
      : `[Action] attempt ${attempt}/${MAX_ATTEMPTS} — returned to queue for retry`);
  };

  // Random delay 0~10 minutes to avoid mechanical publish pattern.
  // NO_DELAY=1로 끌 수 있다 — 특정 키워드를 재발행해 결과를 확인할 때 10분을
  // 기다릴 이유가 없고, 그 사이 Firestore 연결이 끊어지는 문제도 있었다.
  const randomDelay = process.env.NO_DELAY ? 0 : Math.floor(Math.random() * 10 * 60 * 1000);
  console.log(`[Action] Random delay: ${(randomDelay / 1000 / 60).toFixed(1)} minutes`);
  await delay(randomDelay);
  console.log('[Action] Starting publish...\n');

  // Mark as in_progress. lastAttemptAt is what lets reclaimStaleInProgress() tell a
  // genuinely running job from one whose runner died.
  await db.collection('keywords').doc(kw.id).update({
    status: 'in_progress',
    lastAttemptAt: new Date().toISOString(),
  });

  try {
    const result = await publishOneArticle(kw);
    const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1);
    if (result) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`SUCCESS`);
      console.log(`Title: ${result.title}`);
      console.log(`URL: /ko/${kw.category}/${result.slug}`);
      console.log(`Total time: ${totalTime}s`);
      console.log(`${'='.repeat(60)}`);
    } else {
      console.log(`\nFailed: no hospitals found (${totalTime}s)`);
      await giveUp('no hospitals found');
    }
  } catch (e) {
    console.error('\nError:', e.message);
    await giveUp(e.message);
  console.log(`[openai] token usage this run:\n${usageSummary()}`);
    process.exit(1);
  }

  console.log(`[openai] token usage this run:\n${usageSummary()}`);
  process.exit(0);
}

// `node publish-action.js`로 직접 실행할 때만 발행한다.
// require로 불러오는 경우(프롬프트 검증 스크립트 등)에는 main()이 돌면 안 된다.
if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { GEO_HINTS, buildTranslationPrompt, buildArticlePrompt, sanitizeHtml, orderHospitalsByBody, generateArticle, assertArticleSane, searchNaver, getPlaceInfo, searchKakao, searchGoogle, matchWithGPT };
