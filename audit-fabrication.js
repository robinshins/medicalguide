/**
 * 지어낸 서술 검사. compare-models.js가 저장한 /tmp/cmp-*.html을 감사한다.
 *
 * 검사 대상은 전부 deepseek-v4-pro가 1차 비교에서 실제로 지어낸 것들이다.
 * 프롬프트를 조인 뒤 같은 항목이 재발하는지 보는 것이 목적이라, 새로운 항목을
 * 추가하기보다 관찰된 실패를 그대로 회귀 테스트로 고정한다.
 *
 *   node audit-fabrication.js /tmp/cmp-deepseek-v4-pro.html
 */
const fs = require('fs');

// 없는 데이터를 지어낸 서술의 표지. 문맥과 함께 보고한다.
const PATTERNS = [
  ['방법론조작', /스팸|중복 추정|설문\s*조사|자체\s*평가\s*점수|표본|현장\s*방문|전문가\s*자문|엄선|선별했/],
  ['교통조작',   /\d+번\s*출구|도보\s*약?\s*\d+\s*분|역에서\s*도보|주차장\s*이용이|주차\s*가능\s*대수는/],
  ['점심시간',   /점심시간[은는]?\s*(오후)?\s*\d/],
  ['근거없는추정', /추정되니|것으로\s*추정|로\s*추정됩니다|일\s*가능성이\s*높/],
  ['가격조작',   /공시\s*데이터|시세\s*조사|평균\s*비용은\s*\d/],
];

const STRUCT = [
  ['h3번호접두', /<h3[^>]*>\s*\d+[.)]\s/],
  ['FAQ Q접두',  /<h3[^>]*>\s*Q[.\s]/],
  ['금지태그',   /<(a|br|em|small|dl|dt|dd|div|span|img|h1|h4)[\s>]/],
];

function audit(file) {
  const html = fs.readFileSync(file, 'utf8');
  // blockquote 안은 검사하지 않는다. 리뷰 원문에는 "서면역 13번 출구 바로 앞"처럼
  // 작성자가 직접 쓴 교통 정보가 들어 있고, 그걸 그대로 옮기는 것은 지어낸 것이
  // 아니라 요구된 동작이다. 1차 감사에서 Claude까지 걸려 오탐임이 드러났다.
  const body = html.replace(/<blockquote[\s\S]*?<\/blockquote>/g, ' ');
  const text = body.replace(/<[^>]+>/g, ' ');
  const hits = [];

  for (const [label, re] of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const i = text.indexOf(m[0]);
    const ctx = text.slice(Math.max(0, i - 90), i + 90);
    // "하지 않았습니다 / 거치지 않았다 / 수행하지 않았습니다" 는 부인이지 주장이 아니다.
    // 프롬프트가 금지 절차를 열거하게 만든 결과라 오히려 정직한 서술이다.
    if (/않았|않습니다|없습니다|아닙니다|제외/.test(ctx)) continue;
    hits.push({ label, snippet: ctx.replace(/\s+/g, ' ').trim() });
  }
  for (const [label, re] of STRUCT) {
    const m = body.match(re);
    if (m) hits.push({ label, snippet: m[0].slice(0, 70) });
  }
  return hits;
}

const files = process.argv.slice(2);
if (!files.length) { console.error('사용법: node audit-fabrication.js <file...>'); process.exit(1); }

let total = 0;
for (const f of files) {
  const hits = audit(f);
  total += hits.length;
  console.log(`\n  ${f.split('/').pop()}  →  ${hits.length ? `${hits.length}건 검출` : '깨끗'}`);
  for (const h of hits) console.log(`    [${h.label}] ...${h.snippet}...`);
}
process.exit(total ? 1 : 0);
