const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const slugOf = (k) => k.specialtySlug === 'general' ? k.regionSlug : `${k.regionSlug}-${k.specialtySlug}`;

async function main() {
  // 이 사이트 피부과 큐
  const mine = (await db.collection('keywords').get()).docs
    .map(d => d.data()).filter(k => k.category === 'dermatology');
  // derma 사이트 큐
  const theirs = (await db.collection('keywords_beauty').get()).docs.map(d => d.data());

  const mineSlugs = new Map(mine.map(k => [slugOf(k), k]));
  const theirSlugs = new Map(theirs.map(k => [slugOf(k), k]));

  console.log(`이 사이트 피부과 키워드 : ${mine.length}`);
  console.log(`derma 사이트 키워드      : ${theirs.length}`);

  const overlap = [...mineSlugs.keys()].filter(s => theirSlugs.has(s));
  console.log(`\nslug 겹침 : ${overlap.length}건 (이 사이트 피부과의 ${((overlap.length / mine.length) * 100).toFixed(1)}%)`);

  // 겹치는 것 중, 내 쪽이 아직 pending인 것 = 앞으로 새로 충돌할 것
  const futureClash = overlap.filter(s => mineSlugs.get(s).status === 'pending');
  const theirPublished = futureClash.filter(s => theirSlugs.get(s).status === 'published');
  console.log(`  그중 내 쪽 pending(앞으로 발행 예정) : ${futureClash.length}건`);
  console.log(`    그중 derma가 이미 발행한 것       : ${theirPublished.length}건  ← 발행 즉시 경쟁`);

  // 이미 양쪽 다 글이 있는 것
  let bothLive = 0;
  const sample = [];
  for (const s of overlap.slice(0, 400)) {
    const id = `dermatology-${s}-ko`;
    const [a, b] = await Promise.all([
      db.collection('articles_derma').doc(id).get(),
      db.collection('articles').doc(id).get(),
    ]);
    if (a.exists && b.exists) { bothTick(); if (sample.length < 5) sample.push(s); }
    function bothTick() { bothLive++; }
  }
  console.log(`\n앞 400건 표본 중 양쪽 컬렉션에 글이 다 있는 것: ${bothLive}건`);
  sample.forEach(s => console.log(`    /ko/dermatology/${s}`));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
