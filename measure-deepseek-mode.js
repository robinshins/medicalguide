/**
 * DeepSeek 출력 형식 신뢰성 비교: 순수 JSON vs JSON 모드 vs 마커.
 *
 * 1차 비교에서 DeepSeek이 일본어 번역의 JSON 파싱에 실패했다(position 8449).
 * 본문 HTML 안의 따옴표가 JSON 문자열을 깨는, 이 저장소에서 이미 한 번 겪은
 * 종류의 버그다. 번역은 글 1편당 12번 도는 경로라 간헐적 실패도 비싸다.
 * 어느 형식이 안정적인지 실측으로 고른다.
 *
 *   node measure-deepseek-mode.js
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { buildTranslationPrompt, GEO_HINTS } = require('./publish-action.js');

const LANGS = [
  { lang: 'en', langName: 'English' },
  { lang: 'ja', langName: 'Japanese' },
  { lang: 'zh-TW', langName: 'Traditional Chinese' },
];
const MODEL = 'deepseek-v4-flash';

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
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// 마커 방식: 프롬프트 끝의 JSON 지시만 교체한다
function toMarkers(prompt) {
  return prompt.replace(
    /JSON only: .*$/,
    `Respond using EXACTLY these three markers, no JSON:
===TITLE===
(translated title)
===META===
(translated meta description)
===CONTENT===
(translated HTML content)`
  );
}

function parseJson(t) {
  const m = t.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
  if (!m) throw new Error('JSON 블록 없음');
  return JSON.parse(m[0]);
}
function parseMarkers(t) {
  const m = t.match(/===TITLE===\s*([\s\S]*?)\s*===META===\s*([\s\S]*?)\s*===CONTENT===\s*([\s\S]*?)\s*$/);
  if (!m) throw new Error('마커 없음');
  return { title: m[1].trim(), metaDescription: m[2].trim(), content: m[3].trim() };
}

const tags = (h, t) => (h.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;

async function main() {
  const snap = await db.collection('articles_eye').select('content', 'title', 'region', 'category').get();
  const docs = snap.docs.map(d => d.data()).filter(x => (x.content || '').length > 8000)
    .sort((a, b) => a.content.length - b.content.length);
  const src = docs[Math.floor(docs.length / 2)];
  console.log(`원문 ${src.content.length}자 / ${src.region}\n`);

  const MODES = [
    ['plain-json', p => p, parseJson, {}],
    ['json-mode', p => p, parseJson, { response_format: { type: 'json_object' } }],
    ['markers', toMarkers, parseMarkers, {}],
  ];

  const score = {};
  for (const [mode, xform, parse, extra] of MODES) {
    score[mode] = { ok: 0, fail: 0, in: 0, out: 0 };
    for (const { lang, langName } of LANGS) {
      const prompt = xform(buildTranslationPrompt({
        lang, langName, region: src.region, category: src.category,
        koArticle: { title: src.title, metaDescription: '', content: src.content },
      }));
      try {
        const r = await deepseek.chat.completions.create({
          model: MODEL, messages: [{ role: 'user', content: prompt }],
          max_tokens: 16000, ...extra,
        });
        const out = parse(r.choices[0].message.content);
        const must = GEO_HINTS[lang]?.mustInclude || '';
        const geo = (out.content.split(must).length - 1);
        score[mode].ok++; score[mode].in += r.usage.prompt_tokens; score[mode].out += r.usage.completion_tokens;
        console.log(`  ${mode.padEnd(11)} ${lang.padEnd(6)} OK   본문=${String(out.content.length).padStart(6)} GEO=${geo} h2=${tags(out.content,'h2')}/${tags(src.content,'h2')} 한글제목=${(out.title.match(/[가-힣]/g)||[]).length}`);
      } catch (e) {
        score[mode].fail++;
        console.log(`  ${mode.padEnd(11)} ${lang.padEnd(6)} 실패 ${e.message.slice(0, 70)}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  for (const [m, s] of Object.entries(score)) {
    const cost = (s.in * 0.14 + s.out * 0.28) / 1e6;
    console.log(`  ${m.padEnd(11)} 성공 ${s.ok}/${s.ok + s.fail}   $${(cost / Math.max(s.ok,1)).toFixed(5)}/언어`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
