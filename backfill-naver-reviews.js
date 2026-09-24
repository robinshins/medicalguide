/**
 * 네이버 방문자 리뷰 수가 0으로 저장된 글의 naverReviewCount를 실제 값으로 되돌린다.
 *
 * 2026-07 말부터 네이버 플레이스 홈에 "방문자 리뷰 N"이 없어져 스크래퍼가 대부분 0을
 * 저장했다(publish-action.js getPlaceInfo 수정과 짝이 되는 스크립트). 방문자 수는 리뷰
 * 탭(/review/visitor)의 "리뷰2,199" 줄에 있으므로 그 페이지만 연다.
 *
 * - 대상: SINCE 이후 발행된 치과 글 중 naverReviewCount가 0인 병원이 있는 글
 * - 값을 못 읽으면 건드리지 않는다. 0을 0으로 덮어쓰지 않는다.
 * - 한국어 문서에서 값을 정하고 같은 slug의 13개 언어 문서에 병원 id 기준으로 적용한다.
 * - 고정 순위로 발행된 글(서울/도봉구/창동/쌍문동/방학동 + id 1362748220)은 제외한다.
 *
 *   node backfill-naver-reviews.js            # 조회만
 *   node backfill-naver-reviews.js --apply    # 실제 반영
 *   환경변수: CONCURRENCY(기본 4), SINCE(기본 2026-07-26), CHROME_PATH
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const puppeteer = require('puppeteer-core');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })});
}
const db = admin.firestore();

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const LANGS = ['ko', 'en', 'zh-TW', 'zh-CN', 'ja', 'vi', 'th', 'ru', 'es', 'es-MX', 'pt-BR', 'de', 'it'];
const SINCE = process.env.SINCE || '2026-07-26';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);
const PINNED = { regions: ['서울', '도봉구', '창동', '쌍문동', '방학동'], id: '1362748220' };
const delay = ms => new Promise(r => setTimeout(r, ms));

const isPlaceId = id => /^\d+$/.test(String(id || ''));
const needsCount = h => isPlaceId(h.id) && !(h.naverReviewCount > 0);

// getPlaceInfo(publish-action.js)의 리뷰 탭 파싱과 같은 규칙. null이면 못 읽은 것.
async function getVisitorReviewCount(browser, placeId) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.goto(`https://m.place.naver.com/place/${placeId}/review/visitor`, { waitUntil: 'networkidle2', timeout: 25000 });
    await page.waitForFunction(() => /^리뷰\s*[\d,]+$/m.test(document.body.innerText), { timeout: 5000 }).catch(() => {});
    return await page.evaluate(() => {
      const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      const tabIdx = lines.findIndex(l => l === '방문자 리뷰');
      for (let i = Math.max(tabIdx, 0); i < lines.length; i++) {
        const m = lines[i].match(/^리뷰\s*([\d,]+)$/);
        if (m) return parseInt(m[1].replace(/,/g, ''));
      }
      return null;
    });
  } finally {
    await page.close();
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const snap = await db.collection('articles')
    .where('lang', '==', 'ko')
    .select('slug', 'category', 'region', 'publishedAt', 'hospitals')
    .get();
  const candidates = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.category === 'dental' && a.slug && (a.publishedAt || '') >= SINCE)
    .filter(a => (a.hospitals || []).some(needsCount));
  const isPinned = a => PINNED.regions.includes(a.region) && (a.hospitals || []).some(h => String(h.id) === PINNED.id);
  const targets = candidates.filter(a => !isPinned(a));
  const ids = [...new Set(targets.flatMap(a => a.hospitals.filter(needsCount).map(h => String(h.id))))];
  console.log(`대상 글 ${targets.length}편 (${SINCE} 이후, 고정 순위 글 ${candidates.length - targets.length}편 제외) · 확인할 병원 ${ids.length}곳 · 동시 ${CONCURRENCY}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const counts = new Map();
  let failed = 0, cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      let n = null;
      for (let attempt = 0; attempt < 2 && n === null; attempt++) {
        try { n = await getVisitorReviewCount(browser, id); } catch (e) { n = null; }
        if (n === null && attempt === 0) await delay(2000);
      }
      if (n === null) failed++; else counts.set(id, n);
      console.log(`  [${counts.size + failed}/${ids.length}] ${id} → ${n === null ? '못 읽음' : n}`);
      await delay(500);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  await browser.close();

  // 글별 변경 목록
  const bySlug = new Map(); // slug → { base: docId without -ko, map: id → count }
  let hospitalsChanged = 0;
  for (const a of targets) {
    const map = new Map();
    for (const h of a.hospitals) {
      const n = counts.get(String(h.id));
      if (needsCount(h) && n > 0) map.set(String(h.id), n);
    }
    if (!map.size) continue;
    hospitalsChanged += map.size;
    bySlug.set(a.slug, { base: a.id.replace(/-ko$/, ''), map });
    const desc = a.hospitals.filter(h => map.has(String(h.id))).map(h => `${h.name} 0→${map.get(String(h.id))}`).join(', ');
    console.log(`${(a.publishedAt || '').slice(0, 10)} ${a.slug}: ${desc}`);
  }

  // 같은 slug의 13개 언어 문서에 병원 id 기준으로 적용
  let written = 0;
  if (apply) {
    let batch = db.batch(), n = 0;
    for (const { base, map } of bySlug.values()) {
      const refs = LANGS.map(l => db.collection('articles').doc(`${base}-${l}`));
      const docs = await db.getAll(...refs);
      for (const d of docs) {
        if (!d.exists) continue;
        const hospitals = (d.data().hospitals || []).map(h =>
          needsCount(h) && map.has(String(h.id)) ? { ...h, naverReviewCount: map.get(String(h.id)) } : h);
        batch.update(d.ref, { hospitals });
        written++;
        if (++n >= 450) { await batch.commit(); batch = db.batch(); n = 0; }
      }
    }
    if (n) await batch.commit();
  } else {
    written = bySlug.size * LANGS.length;
  }

  console.log(`\n  병원 ${ids.length}곳 확인 · 못 읽음 ${failed}곳 · 값 바뀌는 병원 ${hospitalsChanged}건 · 글 ${bySlug.size}편`);
  console.log(`  ${apply ? '반영 완료' : '(dry-run — 실제로 바꾸려면 --apply)'}: 문서 ${written}개`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
