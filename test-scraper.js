const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function launchBrowser() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  let execPath = '';
  for (const p of paths) {
    if (fs.existsSync(p)) { execPath = p; break; }
  }
  if (!execPath) {
    // Try playwright chromium
    const homeDir = process.env.HOME || '';
    const pwPaths = [
      path.join(homeDir, 'Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    ];
    for (const p of pwPaths) {
      if (fs.existsSync(p)) { execPath = p; break; }
    }
  }
  if (!execPath) throw new Error('No Chrome found');
  return puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function searchNaver(query) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.goto(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}&where=place`, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

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

async function getPlaceDetail(placeId) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
  await page.goto(`https://m.place.naver.com/place/${placeId}/home`, { waitUntil: 'networkidle2', timeout: 25000 });
  await new Promise(r => setTimeout(r, 1500));

  const detail = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '', address = '', phone = '', businessHours = '', specialistsInfo = '';
    let naverReviewCount = 0, naverBlogReviewCount = 0, facilities = '', directions = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i < 5 && !name && line.length > 1 && line.length < 50 && !line.includes('이전') && !line.includes('플레이스')) name = line;
      const vm = line.match(/방문자 리뷰\s*([\d,]+)/);
      if (vm) naverReviewCount = parseInt(vm[1].replace(/,/g, ''));
      const bm = line.match(/블로그 리뷰\s*([\d,]+)/);
      if (bm) naverBlogReviewCount = parseInt(bm[1].replace(/,/g, ''));
      if (!address && /^(서울|부산|대구|인천|광주|대전|울산|경기)/.test(line) && line.length > 5 && line.length < 80) address = line;
      if (!phone && /^(0\d{1,2}[-)]|0507|1\d{3}[-)])/.test(line)) phone = line.split(/\s/)[0];
      if ((line.includes('진료 시작') || line.includes('진료중')) && !businessHours) businessHours = line;
      if (line.includes('전문의') && line.includes('수')) {
        specialistsInfo = lines.slice(i, Math.min(i + 8, lines.length)).filter(l => l.includes('과') || l.includes('전문의')).join(', ');
      }
      if (line.includes('예약') && line.includes('주차') && !facilities) facilities = line;
      if (line.includes('출구') && !directions) directions = line;
    }
    return { name, address, phone, businessHours, specialistsInfo, naverReviewCount, naverBlogReviewCount, facilities, directions };
  });

  // Get reviews
  await page.goto(`https://m.place.naver.com/place/${placeId}/review/visitor`, { waitUntil: 'networkidle2', timeout: 25000 });
  await new Promise(r => setTimeout(r, 2000));

  const reviews = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    for (let i = 0; i < lines.length && results.length < 5; i++) {
      if (lines[i].length <= 15 && lines[i + 1] && lines[i + 1].match(/^리뷰 \d+/)) {
        const author = lines[i];
        let j = i + 1;
        while (j < lines.length && (/^(리뷰|팔로우|진료예약|예약|대기)/.test(lines[j]) || lines[j].includes('사진'))) j++;
        let content = '';
        while (j < lines.length) {
          if (/^(방문일|반응 남기기)/.test(lines[j])) break;
          if (lines[j] !== '더보기') content += (content ? ' ' : '') + lines[j];
          j++;
        }
        let date = '';
        for (let k = j; k < Math.min(j + 10, lines.length); k++) {
          const dm = lines[k].match(/(\d{4}년 \d+월 \d+일)/);
          if (dm) { date = dm[1]; break; }
        }
        if (content.length > 5) results.push({ author, content: content.substring(0, 300), date });
        i = j;
      }
    }
    return results;
  });

  await page.close();
  await browser.close();
  return { detail, reviews };
}

async function main() {
  console.log('[Test] Searching Naver for "서울 임플란트 치과"...');
  const places = await searchNaver('서울 임플란트 치과');
  console.log('[Test] Found', places.length, 'places:');
  places.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));

  if (places.length > 0) {
    console.log('\n[Test] Getting detail for:', places[0].name);
    await new Promise(r => setTimeout(r, 3000));
    const { detail, reviews } = await getPlaceDetail(places[0].id);
    console.log('[Test] Detail:', JSON.stringify(detail, null, 2));
    console.log('[Test] Reviews:', reviews.length);
    reviews.forEach(r => console.log(`  "${r.content.substring(0, 80)}..." - ${r.author} (${r.date})`));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
