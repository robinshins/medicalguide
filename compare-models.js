/**
 * 한국어 원문 생성 모델 비교.
 *
 * 스크랩은 한 번만 하고, 완전히 동일한 프롬프트를 각 모델에 넣는다. 발행을 두 번
 * 돌려 비교하면 리뷰 수·평점이 그 사이에 달라져 입력이 같지 않다.
 *
 * 검사 항목은 전부 과거에 실제로 깨졌던 것들이다:
 *  - 조기 종료 (structured outputs가 36% 확률로 900자에서 끝냈다)
 *  - 열린 태그로 끝남 (<blockquote> 한가운데 절단)
 *  - 허용 외 태그 (<dl>/<dt>/<dd>로 흘러 CSS와 FAQ 스키마가 깨짐)
 *  - 이모지 (금지)
 *  - 수치 왜곡 (리뷰 수는 원본과 일치해야 함)
 *
 *   node compare-models.js [키워드id]
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const puppeteer = require('puppeteer-core');
const {
  buildArticlePrompt, generateArticle, searchNaver, getPlaceInfo, searchKakao, searchGoogle,
} = require('./publish-action.js');

// 재검증: Pro를 3회 반복해 조작 재발 여부를 본다. 1회로는 판단할 수 없다.
const MODELS = (process.env.CMP_MODELS || 'claude-sonnet-5,deepseek-v4-pro,deepseek-v4-flash').split(',');
const PRICE = {                       // 1M 토큰당 USD
  'claude-sonnet-5':   { in: 2.00,  out: 10.00 },   // ~8/31 도입가. 9/1부터 3/15
  'deepseek-v4-pro':   { in: 0.435, out: 0.87 },
  'deepseek-v4-flash': { in: 0.14,  out: 0.28 },
};
const ALLOWED = ['h2','h3','p','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','strong'];

const db = admin.firestore();
const count = (h, t) => (h.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;

function grade(a) {
  const c = a.content;
  const tags = [...new Set([...c.matchAll(/<([a-z][a-z0-9]*)[\s>]/g)].map(m => m[1]))];
  const forbidden = tags.filter(t => !ALLOWED.includes(t));
  const faq = (c.match(/<h3[^>]*>[^<]*\?<\/h3>\s*<p>/g) || []).length;
  return {
    chars: c.length,
    h2: count(c, 'h2'), h3: count(c, 'h3'), table: count(c, 'table'),
    blockquote: count(c, 'blockquote'),
    faq,
    금지태그: forbidden.length ? forbidden.join(',') : '없음',
    이모지: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c) ? '있음' : '없음',
    닫힌태그종료: /<\/(h2|h3|p|ul|ol|table|blockquote)>$/.test(c.trimEnd()) ? 'O' : 'X',
    제목길이: a.title.length,
    메타길이: a.metaDescription.length,
  };
}

async function main() {
  const kwId = process.argv[2] || 'dental-seoul-implant';
  const kwDoc = await db.collection('keywords').doc(kwId).get();
  if (!kwDoc.exists) throw new Error(`키워드 없음: ${kwId}`);
  const kw = kwDoc.data();
  console.log(`키워드: ${kw.keyword}\n`);

  // ── 스크랩 1회 ────────────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const hospitals = [];
  try {
    const places = await searchNaver(browser, kw.keyword);
    console.log(`  스크랩: 네이버 ${places.length}곳`);
    for (const p of places.slice(0, 5)) {
      const { detail, reviews } = await getPlaceInfo(browser, p.id);
      const name = detail.name || p.name;
      const [k, g] = await Promise.allSettled([
        searchKakao(browser, name), searchGoogle(browser, name, kw.region),
      ]);
      const kk = k.status === 'fulfilled' && k.value[0] ? k.value[0] : { rating: null, reviewCount: 0 };
      const gg = g.status === 'fulfilled' ? g.value : { rating: null, reviewCount: 0 };
      hospitals.push({
        id: p.id, name, category: detail.category || '', address: detail.address || '',
        phone: detail.phone || '', businessHours: detail.businessHours || '',
        specialistsInfo: detail.specialistsInfo || '', facilities: detail.facilities || '',
        naverReviewCount: detail.naverReviewCount || 0, naverBlogReviewCount: detail.naverBlogReviewCount || 0,
        naverStarRating: detail.naverStarRating ?? null, naverReviews: reviews,
        kakaoRating: kk.rating, kakaoReviewCount: kk.reviewCount, kakaoReviews: [],
        googleRating: gg.rating, googleReviewCount: gg.reviewCount,
        imageUrls: detail.imageUrls || [], homepage: detail.homepage || '',
        blogUrl: detail.blogUrl || '', instagramUrl: '', youtubeUrl: '', facebookUrl: '',
        // 실제 파이프라인이 프롬프트에 넣는 '접근성' 값. 빈 문자열로 두면 모델이
        // 없는 정보를 지어내는지 여부를 잘못 측정하게 된다.
        directions: detail.directions || '',
      });
      console.log(`    + ${name} (네이버 리뷰 ${detail.naverReviewCount}, 리뷰본문 ${reviews.length}건)`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  if (hospitals.length < 3) throw new Error(`병원 ${hospitals.length}곳 — 비교 불가`);

  const prompt = buildArticlePrompt(kw, hospitals);
  console.log(`\n  프롬프트 ${prompt.length.toLocaleString()}자, 병원 ${hospitals.length}곳 (동일 입력)\n`);

  // 원본 수치 — 모델이 지어내지 않았는지 확인용
  const srcNums = hospitals.flatMap(h => [h.naverReviewCount, h.kakaoReviewCount].filter(n => n > 100)).map(String);

  const results = {};
  for (const [idx, model] of MODELS.entries()) {
    process.stdout.write(`  [${idx+1}] ${model} ... `);
    const t0 = Date.now();
    try {
      const a = await generateArticle(kw, hospitals, model);
      const g = grade(a);
      const kept = srcNums.filter(n => a.content.includes(n) || a.content.includes(Number(n).toLocaleString())).length;
      results[`${idx+1}:${model}`] = { ...g, 수치보존: `${kept}/${srcNums.length}`, sec: ((Date.now() - t0) / 1000).toFixed(0), title: a.title, sample: a.content };
      console.log('OK');
    } catch (e) {
      results[`${idx+1}:${model}`] = { error: e.message.slice(0, 100), sec: ((Date.now() - t0) / 1000).toFixed(0) };
      console.log(`실패 — ${e.message.slice(0, 80)}`);
    }
  }

  // ── 표 ────────────────────────────────────────────────────────────────
  const keys = ['chars','h2','h3','table','blockquote','faq','금지태그','이모지','닫힌태그종료','수치보존','제목길이','메타길이','sec'];
  console.log(`\n${'='.repeat(84)}`);
  console.log('  ' + '항목'.padEnd(14) + MODELS.map((m,i) => `${i+1}:${m}`.padEnd(24)).join(''));
  console.log('  ' + '-'.repeat(80));
  for (const k of keys) {
    console.log('  ' + k.padEnd(14) + MODELS.map((m,i) => String(results[`${i+1}:${m}`]?.[k] ?? results[`${i+1}:${m}`]?.error?.slice(0,18) ?? '-').padEnd(24)).join(''));
  }

  console.log(`\n  비용 (이 글 1편 기준, 출력 토큰은 문자수로 근사)`);
  for (const [i, m] of MODELS.entries()) {
    const r = results[`${i+1}:${m}`];
    if (!r || r.error) { console.log(`    ${m.padEnd(20)} —`); continue; }
    console.log(`    ${m.padEnd(20)} ${r.chars.toLocaleString()}자  ${r.sec}초`);
  }

  console.log(`\n  제목`);
  for (const [i, m] of MODELS.entries()) console.log(`    ${(i+1)+':'+m}`.padEnd(24) + ` ${results[`${i+1}:${m}`]?.title || results[`${i+1}:${m}`]?.error || '-'}`);

  // 전체 출력을 파일로 — 수치 감사를 위해 본문 전체가 필요하다
  const fs = require('fs');
  fs.writeFileSync('/tmp/cmp-source.json', JSON.stringify({ keyword: kw, hospitals: hospitals.map(h => ({
    name: h.name, address: h.address, naverReviewCount: h.naverReviewCount, naverStarRating: h.naverStarRating,
    kakaoRating: h.kakaoRating, kakaoReviewCount: h.kakaoReviewCount,
    googleRating: h.googleRating, googleReviewCount: h.googleReviewCount, specialistsInfo: h.specialistsInfo,
    directions: h.directions,
  })) }, null, 2));
  for (const [i, m] of MODELS.entries()) {
    const r = results[`${i+1}:${m}`];
    if (!r?.sample) continue;
    fs.writeFileSync(`/tmp/cmp-${i+1}-${m}.html`, `<!-- ${r.title} -->\n` + r.sample);
  }
  console.log('\n  전체 출력: /tmp/cmp-source.json, /tmp/cmp-<model>.html');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
