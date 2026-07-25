/**
 * 발행 1회당 OpenAI 실소비 토큰 측정.
 *
 * 기존 사이트의 OpenAI 소비는 사실상 전부 번역(12개 언어)이다. 실제 발행된
 * 정상 길이 한국어 글로 진짜 번역 프롬프트를 만들어 1개 언어를 호출하고,
 * 측정된 usage를 언어 수만큼 환산한다. 글자수 기반 추정이 아니라 실측이다.
 *
 *   node measure-tokens.js
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { buildTranslationPrompt } = require('./publish-action.js');

const LANGS = ['en', 'ja', 'es', 'zh-TW', 'zh-CN', 'es-MX', 'vi', 'pt-BR', 'de', 'it', 'ru', 'th'];
// 실측 대상. 언어마다 토큰화 효율이 크게 다르므로(라틴 vs CJK vs 태국어)
// 양 극단과 중간을 뽑아 평균이 한쪽으로 치우치지 않게 한다.
const SAMPLE = ['en', 'ja', 'th'];

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
  const snap = await db.collection('articles').select('content', 'lang', 'region', 'category', 'keyword').get();
  const full = snap.docs
    .map(d => ({ d, x: d.data() }))
    .filter(({ x }) => x.lang === 'ko' && (x.content || '').length > 7000)
    .sort((a, b) => (b.x.content.length - a.x.content.length));

  const mid = full[Math.floor(full.length / 2)];
  const koArticle = {
    title: mid.x.keyword,
    metaDescription: '',
    content: mid.x.content,
  };
  console.log(`기준 글: ${mid.d.id}  (${mid.x.content.length}자, 정상 길이 글 ${full.length}편 중 중앙값)\n`);

  let inSum = 0, outSum = 0;
  for (const lang of SAMPLE) {
    const prompt = buildTranslationPrompt({
      lang,
      langName: lang,
      region: mid.x.region,
      category: mid.x.category,
      koArticle,
    });
    const res = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: [{ role: 'user', content: prompt }],
    });
    const u = res.usage || {};
    const i = u.input_tokens || 0, o = u.output_tokens || 0;
    inSum += i; outSum += o;
    console.log(`  ${lang.padEnd(6)} in=${String(i).padStart(6)} out=${String(o).padStart(6)}  합 ${i + o}`);
  }

  const avgIn = inSum / SAMPLE.length, avgOut = outSum / SAMPLE.length;
  const perArticle = (avgIn + avgOut) * LANGS.length;
  console.log(`\n  언어 1개 평균: in=${Math.round(avgIn)} out=${Math.round(avgOut)} → ${Math.round(avgIn + avgOut)}`);
  console.log(`  번역 ${LANGS.length}개 언어 = ${Math.round(perArticle).toLocaleString()} 토큰`);
  console.log(`  + 병원 매칭 약 1,700`);
  console.log(`  ⇒ 기존 사이트 글 1편당 약 ${Math.round(perArticle + 1700).toLocaleString()} 토큰`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
