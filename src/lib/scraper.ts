import type { HospitalInfo, ReviewItem } from './types';
import type { Browser } from 'puppeteer-core';

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import('puppeteer-core')).default;
  const fs = await import('fs');
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  let execPath = '';
  for (const p of paths) {
    if (fs.existsSync(p)) { execPath = p; break; }
  }
  if (!execPath) {
    const path = await import('path');
    const homeDir = process.env.HOME || '';
    const pwPaths = [
      path.join(homeDir, 'Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    ];
    for (const p of pwPaths) {
      if (fs.existsSync(p)) { execPath = p; break; }
    }
  }
  if (!execPath) throw new Error('No Chrome/Chromium found');
  return puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Naver Places Search ---
export async function searchNaverPlaces(query: string): Promise<{ id: string; name: string }[]> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    await page.goto(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}&where=place`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await delay(2000);

    const places = await page.evaluate(() => {
      const root = document.querySelector('#place-app-root');
      if (!root) return [];
      const links = root.querySelectorAll('a[href*="place.naver.com/place/"], a[href*="place.naver.com/hospital/"]');
      const seen = new Set<string>();
      const results: { id: string; name: string }[] = [];
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (href.includes('ader.naver.com')) continue;
        const match = href.match(/(?:place|hospital)\/(\d+)/);
        if (!match || seen.has(match[1])) continue;
        const text = (link.textContent || '').trim();
        if (text.includes('이미지') || text.includes('진료') || text.includes('휴게') || text.includes('MY') || text.includes('검색') || text.includes('©') || text.length < 2) continue;
        const name = text.replace(/톡톡/g, '').replace(/예약$/g, '').trim();
        if (name.length < 2) continue;
        seen.add(match[1]);
        results.push({ id: match[1], name });
      }
      return results.slice(0, 5);
    });
    await page.close();
    return places;
  } finally {
    await browser.close();
  }
}

// --- Naver Place Detail + Social Links + Images + Reviews ---
export async function getNaverPlaceInfo(placeId: string): Promise<{
  detail: Partial<HospitalInfo>;
  reviews: ReviewItem[];
}> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');

    // Use /hospital/ path for medical places (has HIRA data)
    await page.goto(`https://m.place.naver.com/hospital/${placeId}/home`, {
      waitUntil: 'networkidle2', timeout: 25000,
    });
    await delay(1500);

    // Step 1: Scroll to trigger lazy loading of HIRA specialist data
    for (let s = 0; s < 5; s++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(400);
    }
    await delay(1500);

    // Step 2: Click all "펼쳐보기" buttons (expands business hours)
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && el.textContent && el.textContent.trim() === '펼쳐보기') {
          (el as HTMLElement).click();
        }
      });
    });
    await delay(800);

    const detail = await page.evaluate(() => {
      // --- Parse via innerText for basic info ---
      const text = document.body.innerText;
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      let name = '', category = '', address = '', phone = '', businessHours = '';
      let facilities = '', homepage = '', directions = '';
      let naverReviewCount = 0, naverBlogReviewCount = 0;
      let naverStarRating: number | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i < 5 && !name && line.length > 1 && line.length < 50 &&
            !line.includes('이전') && !line.includes('플레이스') && !line.includes('마이')) name = line;
        if (i < 8 && !category && (line.includes('치과') || line.includes('피부과') || line.includes('병원'))) category = line;
        const starMatch = line.match(/별점\s*(\d+\.?\d*)/);
        if (starMatch) naverStarRating = parseFloat(starMatch[1]);
        const vm = line.match(/방문자 리뷰\s*([\d,]+)/);
        if (vm) naverReviewCount = parseInt(vm[1].replace(/,/g, ''));
        const bm = line.match(/블로그 리뷰\s*([\d,]+)/);
        if (bm) naverBlogReviewCount = parseInt(bm[1].replace(/,/g, ''));
        if (!address && /^(서울|부산|대구|인천|광주|대전|울산|경기|충|전|강원|제주|세종)/.test(line) && line.length > 5 && line.length < 80) address = line;
        if (!phone && /^(0\d{1,2}[-)]|1\d{3}[-)]|0507)/.test(line)) phone = line.split(/\s/)[0];
        if (line.startsWith('http') && !homepage) homepage = line;
        if (line.includes('예약') && line.includes('주차') && !facilities) facilities = line;
        if ((line.includes('출구') || line.includes('찾아가는길')) && !directions) directions = line;
      }

      // --- Parse business hours from expanded section ---
      const hoursIdx = lines.findIndex(l => l.includes('영업시간'));
      if (hoursIdx >= 0) {
        const hourLines: string[] = [];
        const dayMap: Record<string, string> = { '월': '월', '화': '화', '수': '수', '목': '목', '금': '금', '토': '토', '일': '일' };
        for (let i = hoursIdx + 1; i < Math.min(hoursIdx + 30, lines.length); i++) {
          const line = lines[i];
          if (line === '접기' || line.includes('영업시간 수정') || line.includes('전화번호')) break;
          // Day + time pattern: "월" then "10:00 - 20:00"
          if (dayMap[line] && i + 1 < lines.length && lines[i + 1].match(/\d{2}:\d{2}/)) {
            hourLines.push(`${line} ${lines[i + 1]}`);
          } else if (line.includes('휴무') && lines[i - 1] && dayMap[lines[i - 1]?.replace(/[()\/\d]/g, '')]) {
            // Skip standalone 휴무 lines already captured
          }
        }
        if (hourLines.length > 0) {
          businessHours = hourLines.join(' / ');
        }
      }
      // Fallback: if no expanded hours, use single-line pattern
      if (!businessHours) {
        for (const line of lines) {
          if ((line.includes('진료 시작') || line.includes('진료중') || line.includes('영업')) && line.length < 40) {
            businessHours = line;
            break;
          }
        }
      }

      // --- Parse specialist info from DOM (HIRA data, lazy-loaded) ---
      let specialistsInfo = '';
      const specialistTable = document.querySelector('h3.kfVkg');
      if (specialistTable) {
        // Find all HIRA sections
        const hiraSections = document.querySelectorAll('.DAQTB');
        const parts: string[] = [];
        hiraSections.forEach(section => {
          const heading = section.querySelector('h3')?.textContent?.trim() || '';
          if (heading.includes('전문의')) {
            // Parse specialist table
            const rows = section.querySelectorAll('tbody tr');
            rows.forEach(row => {
              const dept = row.querySelector('th')?.textContent?.trim() || '';
              const count = row.querySelector('td')?.textContent?.trim() || '';
              if (dept && count) parts.push(`${dept} 전문의 ${count}명`);
            });
          } else if (heading.includes('진료과목')) {
            const items = section.querySelectorAll('li');
            const depts: string[] = [];
            items.forEach(li => { if (li.textContent) depts.push(li.textContent.trim()); });
            if (depts.length > 0) parts.push(`진료과목: ${depts.join(', ')}`);
          } else if (heading.includes('특수진료장비')) {
            const rows = section.querySelectorAll('tbody tr');
            rows.forEach(row => {
              const equip = row.querySelector('th')?.textContent?.trim() || '';
              const count = row.querySelector('td')?.textContent?.trim() || '';
              if (equip && count) parts.push(`${equip} ${count}대`);
            });
          }
        });
        specialistsInfo = parts.join(' | ');
      }
      // Fallback: try innerText patterns
      if (!specialistsInfo) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('전문의') && (lines[i].includes('수') || lines[i].includes('정보'))) {
            specialistsInfo = lines.slice(i, Math.min(i + 8, lines.length))
              .filter((l: string) => l.includes('과') || l.includes('전문의')).join(', ');
            break;
          }
        }
      }

      // --- Social links ---
      let blogUrl = '', instagramUrl = '', youtubeUrl = '', facebookUrl = '';
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.includes('instagram.com') && !instagramUrl) instagramUrl = href;
        if (href.includes('blog.naver.com') && !blogUrl) blogUrl = href;
        if (href.includes('youtube.com') && !youtubeUrl) youtubeUrl = href;
        if (href.includes('facebook.com') && !facebookUrl) facebookUrl = href;
      });

      // --- Images ---
      const imageUrls: string[] = [];
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) imageUrls.push(ogImg.getAttribute('content') || '');
      document.querySelectorAll('img[src*="pstatic"]').forEach(img => {
        const src = img.getAttribute('src') || '';
        if ((src.includes('phinf') || src.includes('ldb-phinf')) &&
            !src.includes('icon') && !src.includes('profile') && !src.includes('banner')) {
          imageUrls.push(src);
        }
      });

      const cleanAddr = address.replace(/지도내비게이션거리뷰/g, '').replace(/지도$/, '').trim();
      const cleanPhone = phone.replace(/복사$/g, '').trim();
      const cleanedImages = imageUrls.filter(Boolean).slice(0, 3).map(url =>
        url
      );

      return {
        name, category, address: cleanAddr, phone: cleanPhone, businessHours,
        specialistsInfo, facilities, homepage, directions,
        naverReviewCount, naverBlogReviewCount, naverStarRating,
        blogUrl, instagramUrl, youtubeUrl, facebookUrl,
        imageUrls: cleanedImages,
      };
    });

    // Get reviews
    await page.goto(`https://m.place.naver.com/place/${placeId}/review/visitor`, {
      waitUntil: 'networkidle2', timeout: 25000,
    });
    await delay(2000);

    const rawReviews = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const results: { author: string; content: string; date: string; visitCount: string }[] = [];
      for (let i = 0; i < lines.length && results.length < 8; i++) {
        if (lines[i].length <= 15 && lines[i + 1]?.match(/^리뷰 \d+/)) {
          const author = lines[i];
          let j = i + 1;
          while (j < lines.length && (/^(리뷰|팔로우|진료예약|예약|대기)/.test(lines[j]) || lines[j].includes('사진'))) j++;
          let content = '';
          while (j < lines.length) {
            if (/^(방문일|반응 남기기)/.test(lines[j]) || /^\d+\.\d+\./.test(lines[j])) break;
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
          if (content.length > 5) results.push({ author, content: content.substring(0, 400), date, visitCount });
          i = j;
        }
      }
      return results;
    });

    await page.close();
    return {
      detail: {
        id: placeId,
        name: detail.name,
        category: detail.category,
        address: detail.address,
        phone: detail.phone,
        businessHours: detail.businessHours,
        specialistsInfo: detail.specialistsInfo,
        facilities: detail.facilities,
        homepage: detail.homepage,
        directions: detail.directions,
        naverReviewCount: detail.naverReviewCount,
        naverBlogReviewCount: detail.naverBlogReviewCount,
        naverStarRating: detail.naverStarRating,
        blogUrl: detail.blogUrl,
        instagramUrl: detail.instagramUrl,
        youtubeUrl: detail.youtubeUrl,
        facebookUrl: detail.facebookUrl,
        imageUrls: detail.imageUrls,
      },
      reviews: rawReviews.map(r => ({ ...r, source: 'naver' as const })),
    };
  } finally {
    await browser.close();
  }
}

// --- Kakao Map Search ---
export async function searchKakaoMap(query: string): Promise<{
  name: string; rating: number | null; reviewCount: number;
  address: string; hours: string; phone: string;
}[]> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    await page.goto(`https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await delay(2000);

    const results = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const places: { name: string; rating: number | null; reviewCount: number; address: string; hours: string; phone: string }[] = [];
      for (let i = 0; i < lines.length && places.length < 10; i++) {
        if (/(치과|피부과|병원|의원|대학병원|종합병원)$/.test(lines[i]) && lines[i].length > 2) {
          const name = lines[i];
          let rating: number | null = null, reviewCount = 0, address = '', hours = '', phone = '';
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (lines[j].includes('평점') || (lines[j - 1]?.includes('평점') && /^\d/.test(lines[j]))) {
              const rm = lines[j].match(/(\d+\.?\d*)/);
              if (rm) rating = parseFloat(rm[1]);
            }
            const rcm = lines[j].match(/리뷰\s*(\d[\d,]*)/);
            if (rcm) reviewCount = parseInt(rcm[1].replace(/,/g, ''));
            const cm = lines[j].match(/\((\d[\d,]*)\)/);
            if (cm && !reviewCount) reviewCount = parseInt(cm[1].replace(/,/g, ''));
            if (/^(서울|부산|대구|인천|광주|대전|울산|경기|충|전|강원|제주|세종)/.test(lines[j]) && !address) address = lines[j];
            if ((lines[j].includes('진료') || lines[j].includes('영업') || lines[j].includes('브레이크타임')) && !hours) hours = lines[j];
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
  } finally {
    await browser.close();
  }
}

// --- Google Maps Search (rating + review count) ---
export async function searchGoogleMaps(hospitalName: string, region: string): Promise<{
  rating: number | null; reviewCount: number;
}> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(hospitalName + ' ' + region)}`, {
      waitUntil: 'networkidle2', timeout: 20000,
    });
    await delay(2000);

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      // Look for rating pattern like "4.7" near review counts
      const ratingMatch = text.match(/(\d\.\d)\s*\n/);
      const reviewMatch = text.match(/\((\d[\d,]*)\)/);
      return {
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
        reviewCount: reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0,
      };
    });
    await page.close();
    return result;
  } finally {
    await browser.close();
  }
}

// --- Combined scraper: full pipeline ---
export async function scrapeHospitalData(searchQuery: string, region?: string): Promise<HospitalInfo[]> {
  console.log(`[Scraper] Searching Naver for: ${searchQuery}`);
  const naverPlaces = await searchNaverPlaces(searchQuery);
  console.log(`[Scraper] Found ${naverPlaces.length} Naver places`);
  if (naverPlaces.length === 0) return [];

  // Get Kakao data
  let kakaoPlaces: Awaited<ReturnType<typeof searchKakaoMap>> = [];
  try {
    await delay(2000);
    kakaoPlaces = await searchKakaoMap(searchQuery);
    console.log(`[Scraper] Found ${kakaoPlaces.length} Kakao places`);
  } catch (e) {
    console.error('[Scraper] Kakao search failed:', e);
  }

  const hospitals: HospitalInfo[] = [];

  for (const place of naverPlaces.slice(0, 5)) {
    console.log(`[Scraper] Getting info for: ${place.name}`);
    try {
      await delay(3000);
      const { detail, reviews } = await getNaverPlaceInfo(place.id);

      // Match Kakao
      let kakaoRating: number | null = null;
      let kakaoReviewCount = 0;
      const kakaoMatch = kakaoPlaces.find(k =>
        k.name.includes(place.name.substring(0, 3)) || place.name.includes(k.name.substring(0, 3))
      );
      if (kakaoMatch) {
        kakaoRating = kakaoMatch.rating;
        kakaoReviewCount = kakaoMatch.reviewCount;
      }

      // Google Maps
      let googleRating: number | null = null;
      let googleReviewCount = 0;
      try {
        await delay(2000);
        const hospitalRegion = region || (detail.address || '').split(' ').slice(0, 2).join(' ');
        const googleData = await searchGoogleMaps(detail.name || place.name, hospitalRegion);
        googleRating = googleData.rating;
        googleReviewCount = googleData.reviewCount;
        if (googleRating) console.log(`[Scraper]   Google: ${googleRating} (${googleReviewCount} reviews)`);
      } catch (e) {
        console.log(`[Scraper]   Google Maps failed for ${place.name}`);
      }

      hospitals.push({
        id: place.id,
        name: detail.name || place.name,
        category: detail.category || '',
        address: detail.address || '',
        phone: detail.phone || '',
        businessHours: detail.businessHours || '',
        specialistsInfo: detail.specialistsInfo || '',
        facilities: detail.facilities || '',
        naverReviewCount: detail.naverReviewCount || 0,
        naverBlogReviewCount: detail.naverBlogReviewCount || 0,
        naverStarRating: detail.naverStarRating || null,
        naverReviews: reviews,
        kakaoRating,
        kakaoReviewCount,
        kakaoReviews: [],
        googleRating,
        googleReviewCount,
        imageUrls: detail.imageUrls || [],
        homepage: detail.homepage || '',
        blogUrl: detail.blogUrl || '',
        instagramUrl: detail.instagramUrl || '',
        youtubeUrl: detail.youtubeUrl || '',
        facebookUrl: detail.facebookUrl || '',
        directions: detail.directions || '',
      });
    } catch (e) {
      console.error(`[Scraper] Failed for ${place.name}:`, e);
    }
  }

  return hospitals;
}
