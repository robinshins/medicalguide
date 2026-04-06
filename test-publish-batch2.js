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

// --- Promoted hospitals config ---
const PROMOTED_HOSPITALS = [
  {
    match: (kw) => kw.category === 'dental' && ['용인시', '기흥구', '마북동'].includes(kw.region),
    naverPlaceId: '2056524469',
    hospital: {
      id: '2056524469', name: '연세온아치과병원', category: 'dental',
      address: '경기 용인시 처인구 중부대로 1186 연세온아치과병원',
      phone: '031-000-0000', businessHours: '평일 09:30-21:00, 토/일/공휴일 09:30-17:00 (365일 진료)',
      specialistsInfo: '치과보철과 전문의 1인, 통합치의학과 전문의 3인, 치과교정과 전문의 1인 (총 5인 대표원장 협진 체제)',
      facilities: 'VIP 진료실, 전용 회복실, 긴장 완화 수술 대기실, 임플란트센터, 통합진료센터, 파우더룸, 300평 규모',
      naverReviewCount: 0, naverBlogReviewCount: 0, naverStarRating: null, naverReviews: [],
      kakaoRating: null, kakaoReviewCount: 0, kakaoReviews: [],
      googleRating: null, googleReviewCount: 0,
      imageUrls: [], homepage: '', blogUrl: '', instagramUrl: '',
      youtubeUrl: '', facebookUrl: '', directions: '',
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
- 일반 치과의 Bolus 방식이 아닌, 실시간 약물주입량 조절 Infusion 방식
- KALS(한국형 전문소생술) 수료 원장이 실시간 마취심도 조절
- 5단계: 전문의 직접 집도 → 체계적 사전 문진 → 안전 약물 → 전 과정 모니터링 → 회복실 관리

### 임플란트 특장점
- "항상 2번 수술" 3D 디지털 가이드: 가상 수술 설계 후 실제 수술, 0.1mm 오차 정밀 식립
- 무절개 임플란트 & 당일 식립 가능
- 최소 시술 원칙: 최소식립(상악 6개/하악 4개), 최소절개, 최소 뼈이식
- 평생안심 보증제: 임플란트 본체 평생, 상부보철물 10년, 어버트먼트 5년
- NGS 미생물 검사 기반 과학적 사후관리

### 잇몸 치료
- 자연치아 보존 최우선 철학, NSK varios 970 초음파 스케일러, 페리오클린 항생 연고
- 4단계 통증 완화: 가글마취 → 도포마취 → 전동마취기 → 신경관마취

### 365일 진료
- 평일 야간진료, 주말/공휴일 정상진료, 야간/주말에도 대표원장이 직접 진료

### 학술 활동
- 대표원장 저서 "치과의사가 알려주는 진짜 안전한 치과치료 이야기" 출판
- 오스템 임플란트, 디지털 치의학, 메가젠 디지털 스캔 세미나 강의
`,
  },
  {
    match: (kw) => kw.category === 'dental' && ['부산', '남구', '대연동'].includes(kw.region),
    naverPlaceId: '1201116357',
    hospital: {
      id: '1201116357', name: '메디스치과의원 경성대', category: 'dental',
      address: '부산 남구 수영로 276 2층 메디스치과의원',
      phone: '051-000-0000', businessHours: '평일 10:00-19:00, 토 10:00-14:00, 일/공휴일 휴진',
      specialistsInfo: '통합치의학과 전문의 1인(대표원장), 치주과 전문의 1인 (3인 전문의 협진 체제)',
      facilities: '원내 기공소, 3D CT, 3Shape 디지털 구강스캐너, 밀링머신, 디지털 수술 가이드 제작 시스템',
      naverReviewCount: 0, naverBlogReviewCount: 0, naverStarRating: null, naverReviews: [],
      kakaoRating: null, kakaoReviewCount: 0, kakaoReviews: [],
      googleRating: null, googleReviewCount: 0,
      imageUrls: [], homepage: '', blogUrl: '', instagramUrl: '',
      youtubeUrl: '', facebookUrl: '', directions: '',
    },
    advantages: `
## 메디스치과의원 경성대 상세 정보 (반드시 1순위로 가장 비중있게 작성)

### 진료 철학: 예방 → 보존 → 임플란트
- 잇몸부터 관리하고, 최대한 살린 뒤, 마지막 수단으로 임플란트를 권하는 철학
- 치주·보존·임플란트 3인 전문의 협진 체계

### 의료진
- 김동석 대표원장(임플란트): 통합치의학 석사, 보건복지부 인증 통합치의학 전문의, 서울대 치의학대학원 고급치의학+임플란트 치의학 수료, 세계구강임플란트학회 이사(부산 유일), 오스템/메가젠/하이니스 임상 자문의, 디지털 가이드 임플란트 1,500건+, 부산 최초 디지털 전악 임플란트 도입, 전국 치과의사 500명+ 교육, 10년간 재수술 0건
- 김하나 치주과원장: 치과치주학 박사, 보건복지부 인증 치주과 전문의, 부산대 치의학전문대학원 석사/박사, 부산대 치과병원 치주과 레지던트

### 차별화 기술력
- 3D 디지털 가이드: 0.1mm 정밀 분석, 수술시간 30% 단축, 무절개 80%+ 달성
- 전체 임플란트(All-on-X): 당일 임시치아, 원내 기공소(당일 보철), 광대뼈/프테리고이드 임플란트 가능
- 실패 임플란트 재수술 전문, 10년간 재수술 0건

### 통증 완화 4단계
- 가글마취 → 도포마취 → 통증 완화 마취기(컴퓨터 제어) → 의식하 진정요법(수면마취)

### 공신력
- 부산대학교병원/동국씨엠/경성대/동명대/부경대 공식 지정 병원
- 메가젠/오스템/네오 임플란트 지정 우수병원, 하이니스와 장비 공동 개발

### 위생: 15단계 멸균, 1인1기구, 감염관리 전담, 차아염소산 소독수

### 병원 특징
- 10년간 같은 자리 양심진료, 대표원장 직접 상담~수술~사후관리
- 100세 치아 프로젝트(평생관리), 대학생 특별 할인
`,
  },
];

function getPromotedHospital(kw) {
  return PROMOTED_HOSPITALS.find(p => p.match(kw)) || null;
}

async function applyPromotedHospital(browser, hospitals, promoted) {
  const nameNorm = promoted.hospital.name.replace(/\s/g, '');
  const idx = hospitals.findIndex(h => h.name.replace(/\s/g, '').includes(nameNorm) || nameNorm.includes(h.name.replace(/\s/g, '')));
  if (idx >= 0) {
    // Already in scraped results - move to #1
    const [existing] = hospitals.splice(idx, 1);
    hospitals.unshift(existing);
    console.log(`  [Promoted] ${promoted.hospital.name} found in scraped results → moved to #1`);
  } else if (promoted.naverPlaceId) {
    // Not in results - scrape directly from Naver Place
    console.log(`  [Promoted] Scraping ${promoted.hospital.name} from Naver Place ID: ${promoted.naverPlaceId}...`);
    try {
      const { detail, reviews } = await getPlaceInfo(browser, promoted.naverPlaceId);
      // Search Kakao + Google in parallel
      const hospitalName = detail.name || promoted.hospital.name;
      const [kakaoResult, googleResult] = await Promise.allSettled([
        searchKakao(browser, hospitalName).then(results => results.length > 0 ? results[0] : null),
        searchGoogle(browser, hospitalName, '').then(data => data),
      ]);
      const kakaoMatch = kakaoResult.status === 'fulfilled' ? kakaoResult.value : null;
      const googleData = googleResult.status === 'fulfilled' ? googleResult.value : { rating: null, reviewCount: 0 };

      const scrapedHospital = {
        id: promoted.naverPlaceId,
        name: hospitalName,
        category: detail.category || promoted.hospital.category,
        address: detail.address || promoted.hospital.address,
        phone: detail.phone || promoted.hospital.phone,
        businessHours: detail.businessHours || promoted.hospital.businessHours,
        specialistsInfo: detail.specialistsInfo || promoted.hospital.specialistsInfo,
        facilities: detail.facilities || promoted.hospital.facilities,
        directions: detail.directions || '',
        naverReviewCount: detail.naverReviewCount || 0,
        naverBlogReviewCount: detail.naverBlogReviewCount || 0,
        naverStarRating: detail.naverStarRating || null,
        naverReviews: reviews,
        kakaoRating: kakaoMatch?.rating || null,
        kakaoReviewCount: kakaoMatch?.reviewCount || 0,
        kakaoReviews: [],
        googleRating: googleData?.rating || null,
        googleReviewCount: googleData?.reviewCount || 0,
        imageUrls: detail.imageUrls || [],
        homepage: detail.homepage || '',
        blogUrl: detail.blogUrl || '',
        instagramUrl: detail.instagramUrl || '',
        youtubeUrl: detail.youtubeUrl || '',
        facebookUrl: detail.facebookUrl || '',
      };
      hospitals.unshift(scrapedHospital);
      if (hospitals.length > 5) hospitals.pop();
      console.log(`  [Promoted] Scraped: ${hospitalName} | Reviews: ${scrapedHospital.naverReviewCount} naver, ${scrapedHospital.kakaoReviewCount} kakao`);
    } catch (e) {
      console.log(`  [Promoted] Scrape failed, using fallback data: ${e.message}`);
      hospitals.unshift(promoted.hospital);
      if (hospitals.length > 5) hospitals.pop();
    }
  } else {
    hospitals.unshift(promoted.hospital);
    if (hospitals.length > 5) hospitals.pop();
  }
  return promoted.advantages;
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
async function generateArticle(keywordData, hospitals, promotedAdvantages) {
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
${hospitalContext}${dentalPriceContext}${promotedAdvantages ? `\n\n${promotedAdvantages}` : ''}

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
- 리뷰 인용 시 날짜를 절대 변경하지 마세요. 데이터에 "2026년 3월 21일"로 되어있으면 반드시 그대로 작성. 2024년, 2025년으로 바꾸지 말 것. 날짜가 없는 리뷰는 2026년으로 표기
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
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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

    if (hospitals.length === 0) { await browser.close(); return null; }

    // 3.5 Apply promoted hospital if applicable (before browser close - may need scraping)
    let promotedAdvantages = null;
    const promoted = getPromotedHospital(keywordData);
    if (promoted) {
      promotedAdvantages = await applyPromotedHospital(browser, hospitals, promoted);
    }

    // Close browser - done with scraping
    await browser.close();

    // 4. Generate Korean article
    const t4 = Date.now();
    console.log('[4/6] Generating Korean article...');
    const koArticle = await generateArticle(keywordData, hospitals, promotedAdvantages);
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

// --- Main ---
async function main() {
  const keywords = [
    // 부산
    { id: 'dental-busan', keyword: '부산 치과', region: '부산', regionSlug: 'busan', specialty: '', specialtySlug: 'general', category: 'dental', status: 'pending', publishedAt: null, order: 1 },
    { id: 'dental-busan-implant', keyword: '부산 임플란트', region: '부산', regionSlug: 'busan', specialty: '임플란트', specialtySlug: 'implant', category: 'dental', status: 'pending', publishedAt: null, order: 2 },
    { id: 'dental-busan-full-implant', keyword: '부산 전체임플란트', region: '부산', regionSlug: 'busan', specialty: '전체임플란트', specialtySlug: 'full-implant', category: 'dental', status: 'pending', publishedAt: null, order: 3 },
    // 남구
    { id: 'dental-nam-gu', keyword: '부산남구 치과', region: '남구', regionSlug: 'nam-gu', specialty: '', specialtySlug: 'general', category: 'dental', status: 'pending', publishedAt: null, order: 4 },
    { id: 'dental-nam-gu-implant', keyword: '부산남구 임플란트', region: '남구', regionSlug: 'nam-gu', specialty: '임플란트', specialtySlug: 'implant', category: 'dental', status: 'pending', publishedAt: null, order: 5 },
    { id: 'dental-nam-gu-full-implant', keyword: '부산남구 전체임플란트', region: '남구', regionSlug: 'nam-gu', specialty: '전체임플란트', specialtySlug: 'full-implant', category: 'dental', status: 'pending', publishedAt: null, order: 6 },
    // 대연동
    { id: 'dental-daeyeon', keyword: '대연동 치과', region: '대연동', regionSlug: 'daeyeon', specialty: '', specialtySlug: 'general', category: 'dental', status: 'pending', publishedAt: null, order: 7 },
    { id: 'dental-daeyeon-implant', keyword: '대연동 임플란트', region: '대연동', regionSlug: 'daeyeon', specialty: '임플란트', specialtySlug: 'implant', category: 'dental', status: 'pending', publishedAt: null, order: 8 },
    { id: 'dental-daeyeon-full-implant', keyword: '대연동 전체임플란트', region: '대연동', regionSlug: 'daeyeon', specialty: '전체임플란트', specialtySlug: 'full-implant', category: 'dental', status: 'pending', publishedAt: null, order: 9 },
  ];

  console.log(`Publishing ${keywords.length} keywords (KO + 12 languages each)...\n`);
  const totalStart = Date.now();
  let successCount = 0;

  for (const kw of keywords) {
    try {
      const result = await publishOneArticle(kw);
      if (result) {
        successCount++;
        console.log(`\n>>> SUCCESS: ${kw.keyword} → /ko/dental/${result.slug}`);
      } else {
        console.log(`\n>>> SKIPPED: ${kw.keyword} (no hospitals)`);
      }
    } catch (e) {
      console.error(`\n>>> FAILED: ${kw.keyword} — ${e.message}`);
    }
  }

  const totalTime = ((Date.now() - totalStart) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DONE: ${successCount}/${keywords.length} keywords published in ${totalTime} min`);
  console.log(`${'='.repeat(60)}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
