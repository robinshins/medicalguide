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
async function generateArticle(keywordData, hospitals) {
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
구체적 숫자와 방법론 투명 공개.

### 3) 각 병원 상세 분석 (각 h3, 600-1000자)
<h3>병원명 - 한줄 특징</h3>
각 병원마다 반드시:
a) 추천 근거 (평점, 리뷰수, 전문의수)
b) 실제 리뷰 <blockquote> 최소 2개
c) 위치/교통 + 진료시간
d) 진료시간, 야간진료, 점심시간 명시
e) 방문 전 확인할 점 (예약 방식, 주차, 점심시간 등 실용 정보 위주, 병원 비하 금지)
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

## 문체 규칙
- 이모지 절대 금지
- 구체적 숫자 필수 ("많은 리뷰" X → "리뷰 847건" O)
- 출처 명시
- 자연스러운 구어체 섞기
- AI 인용에 적합한 완결 문장

## SEO
- 제목: "${keywordData.keyword}" 포함, 40-60자, 숫자 포함
- 메타: 120-155자

JSON으로만 응답:
{"title":"SEO 제목","metaDescription":"메타설명","content":"HTML 본문"}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse article');
  return JSON.parse(jsonMatch[0]);
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
    const koArticle = await generateArticle(keywordData, hospitals);
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
      content: koArticle.content, hospitals: hospitalsSummary,
      publishedAt: now, region, specialty: specialty || '일반',
    };
    await db.collection('articles').doc(koDoc.id).set(koDoc);
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
      const prompt = `Translate this Korean medical article to ${langName}. Keep Korean hospital names/addresses in Korean. Maintain HTML structure. No emojis. Natural ${langName} tone.

Title: ${koArticle.title}
Meta: ${koArticle.metaDescription}
Content: ${koArticle.content}

JSON only: {"title":"translated","metaDescription":"translated","content":"translated HTML"}`;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await openaiClient.responses.create({
            model: 'gpt-5.4-mini',
            input: [{ role: 'user', content: prompt }],
          });
          const text = response.output_text;
          const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
          if (!jsonMatch) throw new Error('Parse failed');
          const translated = JSON.parse(jsonMatch[0]);
          const doc = { ...koDoc, id: `${category}-${slug}-${lang}`, lang, title: translated.title, metaDescription: translated.metaDescription, content: translated.content };
          await db.collection('articles').doc(doc.id).set(doc);
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

    await db.collection('keywords').doc(keywordId).set({ ...keywordData, status: 'published', publishedAt: now });
    return koDoc;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

// --- Main: Auto-fetch next pending keyword from Firestore ---
async function main() {
  console.log('[Action] Fetching next pending keyword from Firestore...');
  const totalStart = Date.now();

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
  console.log(`[Action] Next: "${kw.keyword}" (order: ${kw.order}, category: ${kw.category})`);

  console.log('[Action] Starting publish...\n');

  // Mark as in_progress
  await db.collection('keywords').doc(kw.id).update({ status: 'in_progress' });

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
      // Mark as failed so we skip it next time
      await db.collection('keywords').doc(kw.id).update({ status: 'failed' });
    }
  } catch (e) {
    console.error('\nError:', e.message);
    await db.collection('keywords').doc(kw.id).update({ status: 'failed' });
    process.exit(1);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
