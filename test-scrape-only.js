const puppeteer = require('puppeteer-core');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Firebase init ---
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), storageBucket: 'medicalkorea-2205a.firebasestorage.app' });
const db = admin.firestore();

require('dotenv').config({ path: '.env.local' });
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const delay = ms => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

// --- Naver Search ---
async function searchNaver(query) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.goto(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}&where=place`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);
  const places = await page.evaluate(() => {
    const root = document.querySelector('#place-app-root');
    if (!root) return [];
    const links = root.querySelectorAll('a[href*="place.naver.com/place/"]');
    const seen = new Set();
    const results = [];
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/place\/(\d+)/);
      if (!match || seen.has(match[1])) continue;
      const text = (link.textContent || '').trim();
      if (text.includes('이미지수') || text.includes('진료') || text.includes('휴게') || text.length < 2) continue;
      seen.add(match[1]);
      results.push({ id: match[1], name: text.replace(/톡톡/g, '').trim() });
    }
    return results.slice(0, 5);
  });
  await page.close();
  await browser.close();
  return places;
}

// --- Naver Place Detail ---
async function getPlaceInfo(placeId) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.goto(`https://m.place.naver.com/place/${placeId}/home`, { waitUntil: 'networkidle2', timeout: 25000 });
  await delay(1500);

  const detail = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '', address = '', phone = '', businessHours = '', specialistsInfo = '', facilities = '', directions = '', homepage = '';
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
      if ((line.includes('진료 시작') || line.includes('진료중')) && !businessHours) businessHours = line;
      if (line.startsWith('http') && !homepage) homepage = line;
      if (line.includes('전문의') && (line.includes('수') || line.includes('정보'))) {
        specialistsInfo = lines.slice(i, Math.min(i + 8, lines.length)).filter(l => l.includes('과') || l.includes('전문의')).join(', ');
      }
      if (line.includes('예약') && line.includes('주차') && !facilities) facilities = line;
      if (line.includes('출구') && !directions) directions = line;
    }
    let blogUrl = '', instagramUrl = '', youtubeUrl = '', facebookUrl = '';
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('instagram.com') && !instagramUrl) instagramUrl = href;
      if (href.includes('blog.naver.com') && !blogUrl) blogUrl = href;
      if (href.includes('youtube.com') && !youtubeUrl) youtubeUrl = href;
      if (href.includes('facebook.com') && !facebookUrl) facebookUrl = href;
    });
    const imageUrls = [];
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) imageUrls.push(ogImg.getAttribute('content'));
    document.querySelectorAll('img[src*="pstatic"]').forEach(img => {
      const src = img.getAttribute('src') || '';
      if ((src.includes('phinf') || src.includes('ldb-phinf')) && !src.includes('icon') && !src.includes('profile') && !src.includes('banner')) {
        imageUrls.push(src);
      }
    });
    // Convert to uncropped
    const cleanedImages = imageUrls.filter(Boolean).slice(0, 3).map(url =>
      url.replace(/type=f\d+_\d+/, 'type=w800')
    );
    return {
      name, category,
      address: address.replace(/지도내비게이션거리뷰/g, '').replace(/지도$/,'').trim(),
      phone: phone.replace(/복사$/g, '').trim(),
      businessHours, specialistsInfo, facilities, homepage, directions,
      naverReviewCount, naverBlogReviewCount, naverStarRating,
      blogUrl, instagramUrl, youtubeUrl, facebookUrl,
      imageUrls: cleanedImages,
    };
  });

  // Reviews
  await page.goto(`https://m.place.naver.com/place/${placeId}/review/visitor`, { waitUntil: 'networkidle2', timeout: 25000 });
  await delay(2000);
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
  await browser.close();
  return { detail, reviews };
}

// --- Kakao ---
async function searchKakao(query) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
  await page.goto(`https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);
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
  await browser.close();
  return results;
}

// --- Google ---
async function searchGoogle(hospitalName, region) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(hospitalName + ' ' + region)}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2500);
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
  await browser.close();
  return result;
}

// --- GPT Matcher ---
async function matchWithGPT(naverHospital, kakaoCandidates) {
  if (kakaoCandidates.length === 0) return { matchIndex: -1, confidence: 0, reason: 'No candidates' };
  const candidateList = kakaoCandidates.map((c, i) =>
    `[${i}] "${c.name}" | 주소: ${c.address} | 전화: ${c.phone} | 평점: ${c.rating ?? '없음'}`
  ).join('\n');
  try {
    const response = await openaiClient.responses.create({
      model: 'gpt-5.4-mini',
      reasoning: { effort: 'low' },
      input: [
        { role: 'developer', content: '병원 매칭 전문가. JSON으로만 응답.' },
        { role: 'user', content: `네이버: "${naverHospital.name}" (주소: ${naverHospital.address || '?'}, 전화: ${naverHospital.phone || '?'})\n\n카카오 후보:\n${candidateList}\n\n같은 병원을 찾아주세요. {"matchIndex": 번호, "confidence": 0.0~1.0, "reason": "근거"}` },
      ],
    });
    const jsonMatch = response.output_text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { console.log('    GPT matching failed:', e.message); }
  const idx = kakaoCandidates.findIndex(c => c.name.includes(naverHospital.name.substring(0, 4)) || naverHospital.name.includes(c.name.substring(0, 4)));
  return { matchIndex: idx, confidence: idx >= 0 ? 0.5 : 0, reason: 'fallback name match' };
}

// =====================
// MAIN: Scrape only
// =====================
async function main() {
  // 1. Get next pending keyword from Firestore
  console.log('[1] Fetching next pending keyword from Firestore...');
  const snapshot = await db.collection('keywords')
    .where('status', '==', 'pending')
    .orderBy('order', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No pending keywords found!');
    process.exit(0);
  }

  const kw = snapshot.docs[0].data();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Keyword: ${kw.keyword}`);
  console.log(`Region: ${kw.region} | Category: ${kw.category} | Specialty: ${kw.specialty}`);
  console.log(`ID: ${kw.id} | Order: ${kw.order}`);
  console.log(`${'='.repeat(60)}\n`);

  // 2. Naver search
  console.log('[2] Searching Naver Places...');
  const naverPlaces = await searchNaver(kw.keyword);
  console.log(`  Found ${naverPlaces.length} places:`);
  naverPlaces.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (ID: ${p.id})`));

  if (naverPlaces.length === 0) {
    console.log('\nNo places found. Exiting.');
    process.exit(0);
  }

  // 3. Kakao search
  console.log('\n[3] Searching Kakao Map...');
  await delay(2000);
  let kakaoData = [];
  try {
    kakaoData = await searchKakao(kw.keyword);
    console.log(`  Found ${kakaoData.length} results:`);
    kakaoData.forEach((k, i) => console.log(`  ${i + 1}. ${k.name} | 평점: ${k.rating ?? '-'} | 리뷰: ${k.reviewCount} | ${k.address}`));
  } catch (e) {
    console.log('  Kakao failed:', e.message);
  }

  // 4. Get details for each hospital
  console.log('\n[4] Getting hospital details...\n');
  const hospitals = [];

  for (const place of naverPlaces.slice(0, 5)) {
    console.log(`${'─'.repeat(50)}`);
    console.log(`Hospital: ${place.name}`);
    console.log(`${'─'.repeat(50)}`);

    try {
      await delay(3000);
      const { detail, reviews } = await getPlaceInfo(place.id);

      // Kakao match
      let kakaoRating = null, kakaoReviewCount = 0, kakaoMatchName = '-';
      if (kakaoData.length > 0) {
        const gptResult = await matchWithGPT(
          { name: detail.name || place.name, address: detail.address, phone: detail.phone },
          kakaoData
        );
        if (gptResult.matchIndex >= 0 && gptResult.confidence >= 0.6) {
          const match = kakaoData[gptResult.matchIndex];
          kakaoRating = match.rating;
          kakaoReviewCount = match.reviewCount;
          kakaoMatchName = match.name;
        }
      }

      // Google
      let googleRating = null, googleReviewCount = 0;
      try {
        await delay(2000);
        const g = await searchGoogle(detail.name || place.name, kw.region);
        googleRating = g.rating;
        googleReviewCount = g.reviewCount;
      } catch { /* skip */ }

      const hospital = {
        name: detail.name || place.name,
        address: detail.address,
        phone: detail.phone,
        businessHours: detail.businessHours,
        specialistsInfo: detail.specialistsInfo,
        facilities: detail.facilities,
        directions: detail.directions,
        naverStarRating: detail.naverStarRating,
        naverReviewCount: detail.naverReviewCount,
        naverBlogReviewCount: detail.naverBlogReviewCount,
        kakaoRating,
        kakaoReviewCount,
        googleRating,
        googleReviewCount,
        imageUrls: detail.imageUrls,
        homepage: detail.homepage,
        blogUrl: detail.blogUrl,
        instagramUrl: detail.instagramUrl,
        reviews: reviews.length,
      };
      hospitals.push(hospital);

      // Print parsed data
      console.log(`  Name:           ${hospital.name}`);
      console.log(`  Address:        ${hospital.address || '(못 읽음)'}`);
      console.log(`  Phone:          ${hospital.phone || '(못 읽음)'}`);
      console.log(`  Hours:          ${hospital.businessHours || '(못 읽음)'}`);
      console.log(`  Specialists:    ${hospital.specialistsInfo || '(못 읽음)'}`);
      console.log(`  Facilities:     ${hospital.facilities || '(못 읽음)'}`);
      console.log(`  Directions:     ${hospital.directions || '(못 읽음)'}`);
      console.log(`  Naver Rating:   ${hospital.naverStarRating ?? '(없음)'}`);
      console.log(`  Naver Reviews:  ${hospital.naverReviewCount} (블로그: ${hospital.naverBlogReviewCount})`);
      console.log(`  Kakao:          ${kakaoRating ?? '-'} (${kakaoReviewCount}건) [매칭: ${kakaoMatchName}]`);
      console.log(`  Google:         ${googleRating ?? '-'} (${googleReviewCount}건)`);
      console.log(`  Images:         ${hospital.imageUrls.length}장 ${hospital.imageUrls.length > 0 ? hospital.imageUrls[0].substring(0, 80) + '...' : ''}`);
      console.log(`  Homepage:       ${hospital.homepage || '(없음)'}`);
      console.log(`  Blog:           ${hospital.blogUrl || '(없음)'}`);
      console.log(`  Instagram:      ${hospital.instagramUrl || '(없음)'}`);
      console.log(`  Reviews parsed: ${hospital.reviews}건`);

      if (reviews.length > 0) {
        console.log(`  --- Sample reviews ---`);
        reviews.slice(0, 3).forEach((r, i) => {
          console.log(`  [${i + 1}] "${r.content.substring(0, 100)}..." - ${r.author}, ${r.date}`);
        });
      }
      console.log('');
    } catch (e) {
      console.log(`  FAILED: ${e.message}\n`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${hospitals.length} hospitals parsed for "${kw.keyword}"`);
  console.log(`${'='.repeat(60)}`);
  hospitals.forEach((h, i) => {
    console.log(`${i + 1}. ${h.name} — Naver ${h.naverStarRating ?? '-'}(${h.naverReviewCount}) | Kakao ${h.kakaoRating ?? '-'}(${h.kakaoReviewCount}) | Google ${h.googleRating ?? '-'}(${h.googleReviewCount})`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
