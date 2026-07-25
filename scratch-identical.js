const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const h = (s) => crypto.createHash('sha1').update(String(s || '')).digest('hex').substring(0, 12);

async function main() {
  // 이 사이트가 서빙하는 피부과(articles_derma) 중, derma 사이트가 서빙하는
  // 같은 id의 문서(articles)가 있는 것들을 찾아 본문이 동일한지 비교한다.
  const mineSnap = await db.collection('articles_derma').where('lang', '==', 'ko').get();
  console.log(`이 사이트 피부과 ko 글: ${mineSnap.size}건`);

  let bothExist = 0, identical = 0, different = 0;
  const dupes = [];
  for (const doc of mineSnap.docs) {
    const other = await db.collection('articles').doc(doc.id).get();
    if (!other.exists) continue;
    bothExist++;
    const a = doc.data(), b = other.data();
    if (h(a.content) === h(b.content)) { identical++; dupes.push(doc.id); }
    else different++;
  }
  console.log(`\n양쪽에 같은 id로 존재      : ${bothExist}건`);
  console.log(`  본문이 완전히 동일        : ${identical}건  ${identical ? '← 문제' : '← 없음'}`);
  console.log(`  본문이 다름(각자 다른 글) : ${different}건  ← 허용 범위`);
  if (dupes.length) {
    console.log('\n동일 본문 목록:');
    dupes.slice(0, 20).forEach(id => console.log('  ' + id));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
