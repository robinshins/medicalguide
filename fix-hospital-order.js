/**
 * 이미 발행된 글의 병원 카드 순서를 기사 본문 순위에 맞춘다.
 *
 * hospitals 배열은 네이버 검색 결과 순서였는데 카드에는 1~5 번호가 붙어 나가서,
 * 글이 1위로 꼽은 병원이 카드에서 4번으로 보이는 상태였다(치과 627편 중 326편).
 *
 * LLM을 쓰지 않는다 — 저장된 본문의 <h3>에서 병원명을 찾아 순서만 바꾼다.
 * 한국어 문서에서 순서를 정하고 그 언어의 번역본에도 같은 배열을 쓴다. 번역본
 * <h3>는 병원명이 번역돼 있어 자체 매칭이 불가능하기 때문이다.
 *
 *   node fix-hospital-order.js            # 조회만
 *   node fix-hospital-order.js --apply    # 실제 반영
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { orderHospitalsByBody } = require('./publish-action.js');

const COLLECTIONS = ['articles', 'articles_derma'];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })});
}
const db = admin.firestore();

async function main() {
  const apply = process.argv.includes('--apply');
  let scanned = 0, reordered = 0, docsWritten = 0, unmatched = 0;

  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).select('content', 'hospitals', 'lang', 'slug', 'category').get();
    const docs = snap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    // 한국어 문서를 기준으로 순서를 정한다. 키는 {category}-{slug}.
    const korean = docs.filter(d => d.lang === 'ko' && (d.hospitals || []).length > 1);
    const byKey = new Map();
    for (const ko of korean) {
      scanned++;
      const ordered = orderHospitalsByBody(ko.content || '', ko.hospitals);
      const names = ko.hospitals.map(h => h.name);
      const newNames = ordered.map(h => h.name);
      const matchedCount = new Set(
        [...(ko.content || '').matchAll(/<h3[^>]*>(.*?)<\/h3>/gs)]
          .map(m => m[1].replace(/<[^>]+>/g, ''))
          .flatMap(h => names.filter(n => n && h.includes(n)))
      ).size;
      if (matchedCount < names.length) unmatched++;
      if (newNames.join('|') === names.join('|')) continue;
      reordered++;
      byKey.set(`${ko.category}-${ko.slug}`, ordered);
    }

    // 같은 slug의 모든 언어 문서에 동일 배열 적용
    let writes = 0;
    const batchTargets = docs.filter(d => byKey.has(`${d.category}-${d.slug}`));
    if (apply) {
      let batch = db.batch(), n = 0;
      for (const d of batchTargets) {
        batch.update(d.ref, { hospitals: byKey.get(`${d.category}-${d.slug}`) });
        writes++;
        if (++n >= 450) { await batch.commit(); batch = db.batch(); n = 0; }
      }
      if (n) await batch.commit();
    } else {
      writes = batchTargets.length;
    }
    docsWritten += writes;
    console.log(`  ${col.padEnd(16)} 한국어 ${korean.length}편 / 순서 변경 ${byKey.size}편 / 문서 ${writes}개`);
  }

  console.log(`\n  검사 ${scanned}편 · 순서 바뀜 ${reordered}편 · 일부 매칭 실패 ${unmatched}편`);
  console.log(`  ${apply ? '반영 완료' : '(dry-run — 실제로 바꾸려면 --apply)'}: 문서 ${docsWritten}개`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
