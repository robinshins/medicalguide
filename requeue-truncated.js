/**
 * 잘린 채 발행된 글의 키워드를 큐로 되돌린다.
 *
 * 배경: generateArticle()의 max_tokens가 12000이라 본문이 한도에 붙어 잘렸는데,
 * 파싱만 성공하면 stop_reason을 확인하지 않고 발행했다. derma 러너에는 있던
 * 검사가 이쪽에만 빠져 있었다. 잘린 한국어 글 1편은 12개 언어로 번역까지 되어
 * 깨진 문서 13개가 된다.
 *
 * publish-action.js는 max_tokens=24000 + stop_reason 검사 + assertArticleSane()로
 * 고쳤으므로, 이 스크립트로 되돌린 키워드는 다음 발행 주기에 정상 재생성된다.
 * 기존 문서는 같은 문서 ID로 덮어써지므로 따로 지울 필요가 없다.
 *
 *   node requeue-truncated.js            # 조회만 (dry-run)
 *   node requeue-truncated.js --apply    # 실제 재큐잉
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const MIN_CHARS = 3000; // 정상 글은 7,000~9,000자. 3,000자 미만은 절단으로 본다.

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

async function main() {
  const apply = process.argv.includes('--apply');

  const snap = await db.collection('articles').select('content', 'lang', 'keywordId').get();
  const broken = snap.docs
    .filter(d => d.data().lang === 'ko' && (d.data().content || '').length < MIN_CHARS)
    .map(d => ({ id: d.id, kwId: d.data().keywordId, len: (d.data().content || '').length }));

  broken.sort((a, b) => a.len - b.len);
  console.log(`잘린 한국어 글 ${broken.length}편 (기준 ${MIN_CHARS}자 미만)`);
  broken.forEach(b => console.log(`  ${String(b.len).padStart(5)}자  ${b.id}`));

  const kwIds = [...new Set(broken.map(b => b.kwId).filter(Boolean))];
  console.log(`\n대응 키워드 ${kwIds.length}개`);

  if (!apply) {
    console.log('\n(dry-run — 변경 없음. 실제로 되돌리려면 --apply)');
    return;
  }

  let requeued = 0, missing = 0;
  for (const id of kwIds) {
    const ref = db.collection('keywords').doc(id);
    if (!(await ref.get()).exists) { missing++; continue; }
    await ref.update({
      status: 'pending',
      retryCount: 0,
      publishedAt: null,
      lastAttemptAt: null,
    });
    requeued++;
  }
  console.log(`\n재큐잉 ${requeued}개 / 키워드 문서 없음 ${missing}개`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
