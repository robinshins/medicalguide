const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('keywords').get();
  const all = snap.docs.map(d => d.data());
  const g = (cat) => all.filter(k => k.category === cat);
  const cnt = (arr) => arr.reduce((m, k) => { m[k.status] = (m[k.status] || 0) + 1; return m; }, {});

  const dental = g('dental'), derma = g('dermatology');
  console.log('=== 이 사이트 큐(keywords) ===');
  console.log('  치과  :', cnt(dental), `총 ${dental.length}`);
  console.log('  피부과:', cnt(derma), `총 ${derma.length}`);

  // 이 사이트 피부과가 어디로 쓰이는지 / 이미 쓰인 게 있는지
  const dermaCol = await db.collection('articles_derma').limit(3).get();
  console.log(`\n=== articles_derma (이 사이트 피부과 목적지) ===`);
  console.log(`  문서 존재: ${dermaCol.size > 0 ? '있음' : '비어있음'}`);
  dermaCol.docs.forEach(d => console.log('   ', d.id));

  // published로 표시된 피부과 210건은 실제로 어디에 있나?
  const pubDerma = derma.filter(k => k.status === 'published').slice(0, 5);
  console.log(`\n=== published 표시된 피부과 샘플 5건, 실제 글 위치 ===`);
  for (const k of pubDerma) {
    const slug = k.specialtySlug === 'general' ? k.regionSlug : `${k.regionSlug}-${k.specialtySlug}`;
    const id = `dermatology-${slug}-ko`;
    const inDerma = (await db.collection('articles_derma').doc(id).get()).exists;
    const inShared = (await db.collection('articles').doc(id).get()).exists;
    console.log(`  ${id.padEnd(46)} articles_derma=${inDerma}  articles=${inShared}`);
  }

  // 남은 시간 계산 (12회/일)
  const RUNS_PER_DAY = 12;
  const dPend = dental.filter(k => k.status === 'pending').length;
  const mPend = derma.filter(k => k.status === 'pending').length;
  console.log(`\n=== 소요 예상 (12회/일, 1회 1키워드) ===`);
  console.log(`  치과 잔여 pending  : ${dPend}건 → ${(dPend / RUNS_PER_DAY).toFixed(0)}일 (약 ${(dPend / RUNS_PER_DAY / 30).toFixed(1)}개월)`);
  console.log(`  피부과 잔여 pending: ${mPend}건 → ${(mPend / RUNS_PER_DAY).toFixed(0)}일 (약 ${(mPend / RUNS_PER_DAY / 30).toFixed(1)}개월)`);
  console.log(`  합계               : ${dPend + mPend}건 → ${((dPend + mPend) / RUNS_PER_DAY).toFixed(0)}일 (약 ${((dPend + mPend) / RUNS_PER_DAY / 365).toFixed(1)}년)`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
