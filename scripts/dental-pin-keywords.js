/**
 * 이백점·브라이튼·경성대 메디스 큐 대상 키워드.
 * medicalkoreaguide id 접두사는 dental, medguide-dental2는 dental2.
 * 메디스는 koreadentalinfo(dental)만. 부산·남구·대연동에 실제로 있는 일반·임플란트·전체임플란트.
 */

const IBAEK_REGIONS = [
  { name: '신월동', slug: 'sinwol' },
  { name: '양천구', slug: 'yangcheon' },
  { name: '화곡동', slug: 'hwagok' },
  { name: '강서구', slug: 'gangseo' },
  { name: '부천', slug: 'bucheon' },
];

const IBAEK_SPECS = [
  { name: '충치치료', slug: 'cavity' },
  { name: '임플란트', slug: 'implant' },
  { name: '사랑니발치', slug: 'wisdom-tooth' },
  { name: '미백', slug: 'whitening' },
  { name: '레진', slug: 'resin' },
  { name: '무삭제라미네이트', slug: 'no-prep-laminate' },
  { name: '신경치료', slug: 'root-canal' },
  { name: '라미네이트', slug: 'laminate' },
];

const BRIGHTON_KEPT = [
  { name: '서울', slug: 'seoul' },
  { name: '도봉구', slug: 'dobong' },
  { name: '창동', slug: 'chang-dong' },
  { name: '쌍문동', slug: 'ssangmun' },
  { name: '방학동', slug: 'banghak' },
];
const NOWON = { name: '노원구', slug: 'nowon' };
const NOKCHEON = { name: '녹천역', slug: 'nokcheon-station' };

const OLD_SPECS = [
  { name: '', slug: '' },
  { name: '임플란트', slug: 'implant' },
  { name: '치아교정', slug: 'orthodontics' },
  { name: '전체임플란트', slug: 'full-implant' },
  { name: '사랑니발치', slug: 'wisdom-tooth' },
  { name: '충치치료', slug: 'cavity' },
];

const MEDIS_REGIONS = [
  { name: '부산', slug: 'busan' },
  { name: '남구', slug: 'nam-gu' },
  { name: '대연동', slug: 'daeyeon' },
];

const MEDIS_SPECS = [
  { name: '', slug: '' },
  { name: '임플란트', slug: 'implant' },
  { name: '전체임플란트', slug: 'full-implant' },
];

const NEW_SPECS = [
  { name: '미백', slug: 'whitening' },
  { name: '레진', slug: 'resin' },
  { name: '심미치료', slug: 'aesthetic' },
  { name: '신경치료', slug: 'root-canal' },
  { name: '턱관절', slug: 'tmj' },
];

function entry(prefix, region, spec) {
  const slug = spec.slug ? `${region.slug}-${spec.slug}` : region.slug;
  return {
    id: `${prefix}-${slug}`,
    slug,
    keyword: spec.name ? `${region.name} ${spec.name} 치과` : `${region.name} 치과`,
    region: region.name,
    regionSlug: region.slug,
    specialty: spec.name || '일반',
    specialtySlug: spec.slug || 'general',
    category: 'dental',
  };
}

function cross(prefix, regions, specs) {
  const out = [];
  for (const region of regions) {
    for (const spec of specs) out.push(entry(prefix, region, spec));
  }
  return out;
}

/**
 * @param {'dental' | 'dental2'} prefix
 * medicalkoreaguide는 브라이튼 기존 5개 지역의 기존 6진료를 다시 당기지 않는다.
 * dental2는 그 글에도 1순위가 없어서 전부 당긴다.
 * 발행 순서는 이백점, 브라이튼, 메디스를 한 편씩 번갈아 둔다. 짧은 쪽이 끝나면 나머지만 이어진다.
 * dental2에는 메디스가 없다.
 */
function buildPinKeywords(prefix) {
  const ibaek = cross(prefix, IBAEK_REGIONS, IBAEK_SPECS);
  const brightonRegions = [...BRIGHTON_KEPT, NOWON, NOKCHEON];
  let brighton;
  if (prefix === 'dental2') {
    brighton = cross(prefix, brightonRegions, [...OLD_SPECS, ...NEW_SPECS]);
  } else {
    const nowonOld = cross(prefix, [NOWON], OLD_SPECS);
    const addedSpecs = cross(prefix, [...BRIGHTON_KEPT, NOWON], NEW_SPECS);
    const nokcheon = cross(prefix, [NOKCHEON], [...OLD_SPECS, ...NEW_SPECS]);
    brighton = [...nowonOld, ...addedSpecs, ...nokcheon];
  }
  const medis = prefix === 'dental' ? cross(prefix, MEDIS_REGIONS, MEDIS_SPECS) : [];
  return interleave3(ibaek, brighton, medis);
}

function interleave3(a, b, c) {
  const out = [];
  const n = Math.max(a.length, b.length, c.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
    if (i < c.length) out.push(c[i]);
  }
  return out;
}

module.exports = { buildPinKeywords };
