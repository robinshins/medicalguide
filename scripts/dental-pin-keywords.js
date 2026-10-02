/**
 * 이백점·브라이튼 큐 대상 키워드.
 * medicalkoreaguide id 접두사는 dental, medguide-dental2는 dental2.
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
  return [...ibaek, ...brighton];
}

module.exports = { buildPinKeywords };
