/**
 * 번역 모델 비교: DeepSeek V4-Flash vs gpt-5.4-mini.
 *
 * 같은 글, 같은 프롬프트로 3개 언어를 각각 번역하고 품질을 기계 검사한다.
 * "번역이 그럴듯해 보인다"로는 판단하지 않는다 — GEO 문구가 실제로 들어갔는지,
 * HTML 구조가 보존됐는지, 한글이 남았는지, 수치가 원문과 일치하는지를 센다.
 * 이 검사들은 전부 과거에 실제로 깨졌던 항목이다(일본어 제목에 한글 잔존 등).
 *
 *   node measure-deepseek.js
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const OpenAI = require('openai');
const { buildTranslationPrompt, GEO_HINTS } = require('./publish-action.js');

const LANGS = [
  { lang: 'en', langName: 'English' },
  { lang: 'ja', langName: 'Japanese' },
  { lang: 'es', langName: 'Spanish' },
];

// 1M 토큰당 USD
const PRICE = {
  'deepseek-v4-flash': { in: 0.14,  out: 0.28 },
  'gpt-5.4-mini':      { in: 0.75,  out: 4.50 },
};

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
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const tags = (html, t) => (html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
const hangul = s => (s.match(/[가-힣]/g) || []).length;

function grade(src, out, lang) {
  const geo = GEO_HINTS[lang];
  const must = geo?.mustInclude || '';
  const body = out.content || '';
  const head = `${out.title || ''} ${out.metaDescription || ''}`;

  // 원문 숫자(리뷰 수·평점) 보존 검사 — 3자리 이상 숫자만
  const srcNums = [...new Set((src.content.match(/\b\d{3,}\b/g) || []))];
  const kept = srcNums.filter(n => body.includes(n)).length;

  return {
    '본문길이': body.length,
    'GEO본문': (body.split(must).length - 1),        // 2회 이상 요구
    'GEO제목/메타': head.includes(must) ? 'O' : 'X',  // 1회 이상 요구
    'h2': `${tags(body, 'h2')}/${tags(src.content, 'h2')}`,
    'h3': `${tags(body, 'h3')}/${tags(src.content, 'h3')}`,
    'table': `${tags(body, 'table')}/${tags(src.content, 'table')}`,
    '제목한글': hangul(out.title || ''),               // 라틴어권은 0이어야
    '수치보존': `${kept}/${srcNums.length}`,
  };
}

function parse(text) {
  const m = text.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
  if (!m) throw new Error('JSON 없음');
  return JSON.parse(m[0]);
}

async function run(client, model, prompt) {
  const t0 = Date.now();
  // gpt-5.x는 chat.completions에서 max_tokens를 거부하고 max_completion_tokens를 요구한다.
  const cap = model.startsWith('gpt-')
    ? { max_completion_tokens: 16000 }
    : { max_tokens: 16000 };
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    ...cap,
  });
  return {
    text: r.choices[0].message.content,
    usage: r.usage,
    sec: ((Date.now() - t0) / 1000).toFixed(1),
    finish: r.choices[0].finish_reason,
  };
}

async function main() {
  const snap = await db.collection('articles_eye').select('content', 'title', 'region', 'category').get();
  const docs = snap.docs.map(d => d.data()).filter(x => (x.content || '').length > 8000)
    .sort((a, b) => a.content.length - b.content.length);
  const src = docs[Math.floor(docs.length / 2)];
  console.log(`원문: ${src.title}\n      ${src.content.length}자, 지역 ${src.region}\n`);

  const totals = {};

  for (const { lang, langName } of LANGS) {
    const prompt = buildTranslationPrompt({
      lang, langName, region: src.region, category: src.category,
      koArticle: { title: src.title, metaDescription: '', content: src.content },
    });
    console.log(`\n${'='.repeat(74)}\n[${lang}]  필수문구: "${GEO_HINTS[lang]?.mustInclude}"\n${'='.repeat(74)}`);

    for (const [label, client, model] of [
      ['deepseek', deepseek, 'deepseek-v4-flash'],
      ['gpt-mini', openai, 'gpt-5.4-mini'],
    ]) {
      try {
        const r = await run(client, model, prompt);
        const out = parse(r.text);
        const g = grade(src, out, lang);
        const p = PRICE[model];
        const cost = (r.usage.prompt_tokens * p.in + r.usage.completion_tokens * p.out) / 1e6;
        totals[label] = totals[label] || { in: 0, out: 0, cost: 0 };
        totals[label].in += r.usage.prompt_tokens;
        totals[label].out += r.usage.completion_tokens;
        totals[label].cost += cost;

        console.log(`\n  ${label}  in=${r.usage.prompt_tokens} out=${r.usage.completion_tokens} ${r.sec}s finish=${r.finish} $${cost.toFixed(5)}`);
        console.log(`    ${Object.entries(g).map(([k, v]) => `${k}=${v}`).join('  ')}`);
        console.log(`    제목: ${(out.title || '').slice(0, 90)}`);
        const i = (out.content || '').indexOf(GEO_HINTS[lang]?.mustInclude || '');
        console.log(`    필수문구 문맥: ${i < 0 ? '(없음)' : '...' + out.content.slice(Math.max(0, i - 70), i + 90).replace(/<[^>]+>/g, ' ') + '...'}`);
      } catch (e) {
        console.log(`\n  ${label}  실패: ${e.message.slice(0, 120)}`);
      }
    }
  }

  console.log(`\n${'='.repeat(74)}\n3개 언어 합계\n${'='.repeat(74)}`);
  for (const [k, v] of Object.entries(totals)) {
    console.log(`  ${k.padEnd(9)} in=${v.in} out=${v.out}  $${v.cost.toFixed(5)}  → 언어당 $${(v.cost / LANGS.length).toFixed(5)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
