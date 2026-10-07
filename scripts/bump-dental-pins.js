/**
 * 이백점·브라이튼·메디스 키워드를 keywords 큐 맨 앞에 둔다.
 * 이미 발행된 이백점·브라이튼은 그대로 둔다. 메디스(부산·남구·대연동)만 재발행으로 되돌린다.
 *
 *   node scripts/bump-dental-pins.js
 *   node scripts/bump-dental-pins.js --apply
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { buildPinKeywords } = require('./dental-pin-keywords');

const SA_PATH = path.join(__dirname, '..', 'medicalkorea-2205a-firebase-adminsdk-fbsvc-70fd6e21f4.json');
if (!fs.existsSync(SA_PATH)) {
  console.error(`Service account file not found at ${SA_PATH}`);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

async function main() {
  const keywords = buildPinKeywords('dental');
  const orderSnap = await db.collection('keywords').select('order').get();
  let minOrder = 0;
  orderSnap.docs.forEach(d => {
    const o = d.data().order;
    if (typeof o === 'number' && o < minOrder) minOrder = o;
  });
  const start = minOrder - keywords.length;
  const MEDIS_REGIONS = new Set(['부산', '남구', '대연동']);
  const counts = { create: 0, requeue: 0, reorderPending: 0, skipInProgress: 0, skipPublished: 0 };
  const batch = db.batch();
  let writes = 0;

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const order = start + i;
    const ref = db.collection('keywords').doc(kw.id);
    const doc = await ref.get();
    if (!doc.exists) {
      counts.create++;
      console.log(`CREATE  order=${order}  ${kw.keyword}  (${kw.id})`);
      if (APPLY) {
        batch.set(ref, { ...kw, status: 'pending', publishedAt: null, order });
        writes++;
      }
      continue;
    }
    const data = doc.data();
    if (data.status === 'in_progress') {
      counts.skipInProgress++;
      console.log(`SKIP    in_progress  ${kw.keyword}  (${kw.id})`);
      continue;
    }
    const requeue = (data.status === 'published' || data.status === 'failed') && MEDIS_REGIONS.has(kw.region);
    if ((data.status === 'published' || data.status === 'failed') && !requeue) {
      counts.skipPublished++;
      console.log(`SKIP    already ${data.status}  ${kw.keyword}`);
      continue;
    }
    const nextStatus = requeue ? 'pending' : data.status;
    if (requeue) counts.requeue++;
    else counts.reorderPending++;
    console.log(`UPDATE  ${data.status} → ${nextStatus}  order ${data.order} → ${order}  ${kw.keyword}`);
    if (APPLY) {
      batch.update(ref, {
        order,
        status: nextStatus,
        publishedAt: nextStatus === 'pending' ? null : data.publishedAt ?? null,
      });
      writes++;
    }
  }

  if (APPLY && writes > 0) await batch.commit();
  console.log('');
  console.log(APPLY ? '반영함' : '조회만 (반영하려면 --apply)');
  console.log(`새로 만듦 ${counts.create} · 재발행으로 되돌림 ${counts.requeue} · 대기 중 순서만 변경 ${counts.reorderPending} · 이미 발행돼 유지 ${counts.skipPublished} · 발행 중이라 건너뜀 ${counts.skipInProgress}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
