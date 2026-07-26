/**
 * 신규 5개 사이트에 영어 번역을 추가했을 때의 토큰 소비 실측.
 *
 * 신규 사이트 글은 기존 사이트보다 길어(8,000~12,700자) 기존 번역 실측치를
 * 그대로 적용하면 과소평가된다. 각 사이트의 실제 발행 글로 실제 영어 번역
 * 프롬프트를 만들어 1회씩 호출하고 usage를 읽는다.
 *
 *   node measure-en.js
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { buildTranslationPrompt } = require('./publish-action.js');

const SITES = ['dental2', 'ortho', 'eye', 'komed', 'plastic'];

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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  let inSum = 0, outSum = 0, n = 0;

  for (const key of SITES) {
    const snap = await db.collection(`articles_${key}`)
      .select('content', 'title', 'region', 'category', 'publishedAt').get();
    if (snap.empty) { console.log(`  ${key}: 글 없음`); continue; }

    // 길이 중앙값 글을 고른다 — 최장/최단은 대표성이 없다
    const docs = snap.docs
      .map(d => d.data())
      .filter(x => (x.content || '').length > 3000)
      .sort((a, b) => a.content.length - b.content.length);
    const x = docs[Math.floor(docs.length / 2)];

    const prompt = buildTranslationPrompt({
      lang: 'en',
      langName: 'English',
      region: x.region,
      category: x.category,
      koArticle: { title: x.title, metaDescription: '', content: x.content },
    });

    const res = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [{ role: 'user', content: prompt }],
    });
    const u = res.usage || {};
    const i = u.input_tokens || 0, o = u.output_tokens || 0;
    inSum += i; outSum += o; n++;
    console.log(`  ${key.padEnd(9)} 원문 ${String(x.content.length).padStart(6)}자  →  in=${String(i).padStart(6)} out=${String(o).padStart(6)}  합 ${i + o}`);
  }

  const ai = inSum / n, ao = outSum / n;
  console.log(`\n  사이트 평균: in=${Math.round(ai)} out=${Math.round(ao)} → 글 1편당 ${Math.round(ai + ao).toLocaleString()} 토큰`);
  console.log(`  신규 5개 × 8회/일 = 40편/일  ⇒  일 +${Math.round((ai + ao) * 40).toLocaleString()} 토큰`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
