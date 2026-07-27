import type { SupportedLang } from './types';

/**
 * 병원 카드의 구조화 데이터 현지화.
 *
 * 본문은 LLM이 12개 언어로 번역하지만, 병원 카드는 Firestore의 구조화 필드를 그대로
 * 렌더링하므로 번역 대상이 아니었다. 그래서 영어 페이지에서도 진료시간이
 * "월 10:00 - 19:00 / 화 ..." 로, 전문의 정보가 "치과 전문의 3명 | 진료과목: ..." 로
 * 한국어인 채 나갔다.
 *
 * LLM을 쓰지 않는다. 대상이 요일 7개, 고정 라벨 몇 개, `전문의 N명` 한 패턴뿐이라
 * 결정론적 변환이 더 정확하고 공짜이며, 이미 저장된 번역본 수천 건을 다시 만들
 * 필요도 없다(렌더 시점 변환).
 */

const WEEKDAYS: Record<SupportedLang, Record<string, string>> = {
  ko:      { 월: '월', 화: '화', 수: '수', 목: '목', 금: '금', 토: '토', 일: '일' },
  en:      { 월: 'Mon', 화: 'Tue', 수: 'Wed', 목: 'Thu', 금: 'Fri', 토: 'Sat', 일: 'Sun' },
  ja:      { 월: '月', 화: '火', 수: '水', 목: '木', 금: '金', 토: '土', 일: '日' },
  'zh-CN': { 월: '周一', 화: '周二', 수: '周三', 목: '周四', 금: '周五', 토: '周六', 일: '周日' },
  'zh-TW': { 월: '週一', 화: '週二', 수: '週三', 목: '週四', 금: '週五', 토: '週六', 일: '週日' },
  vi:      { 월: 'T2', 화: 'T3', 수: 'T4', 목: 'T5', 금: 'T6', 토: 'T7', 일: 'CN' },
  th:      { 월: 'จ.', 화: 'อ.', 수: 'พ.', 목: 'พฤ.', 금: 'ศ.', 토: 'ส.', 일: 'อา.' },
  ru:      { 월: 'Пн', 화: 'Вт', 수: 'Ср', 목: 'Чт', 금: 'Пт', 토: 'Сб', 일: 'Вс' },
  es:      { 월: 'Lun', 화: 'Mar', 수: 'Mié', 목: 'Jue', 금: 'Vie', 토: 'Sáb', 일: 'Dom' },
  'es-MX': { 월: 'Lun', 화: 'Mar', 수: 'Mié', 목: 'Jue', 금: 'Vie', 토: 'Sáb', 일: 'Dom' },
  'pt-BR': { 월: 'Seg', 화: 'Ter', 수: 'Qua', 목: 'Qui', 금: 'Sex', 토: 'Sáb', 일: 'Dom' },
  de:      { 월: 'Mo', 화: 'Di', 수: 'Mi', 목: 'Do', 금: 'Fr', 토: 'Sa', 일: 'So' },
  it:      { 월: 'Lun', 화: 'Mar', 수: 'Mer', 목: 'Gio', 금: 'Ven', 토: 'Sab', 일: 'Dom' },
};

const CLOSED: Record<SupportedLang, string> = {
  ko: '휴무', en: 'Closed', ja: '休診', 'zh-CN': '休息', 'zh-TW': '休息',
  vi: 'Nghỉ', th: 'ปิด', ru: 'Выходной', es: 'Cerrado', 'es-MX': 'Cerrado',
  'pt-BR': 'Fechado', de: 'Geschlossen', it: 'Chiuso',
};

/** `월 10:00 - 19:00 / 화 ...` → 해당 언어. 시각은 24시간제 그대로 둔다. */
export function localizeHours(hours: string, lang: SupportedLang): string {
  if (!hours || lang === 'ko') return hours;
  const days = WEEKDAYS[lang];
  return hours
    .split('/')
    .map(part => {
      const t = part.trim();
      const m = t.match(/^([월화수목금토일])\s*(.*)$/);
      if (!m) return t;
      return `${days[m[1]]} ${m[2].replace(/휴무|정기휴무|휴진/g, CLOSED[lang])}`.trim();
    })
    .join(' / ');
}

/**
 * `치과 전문의 3명 | 진료과목: ... | 콘빔CT 2대` 에서 전문의 수만 뽑아 현지화한다.
 *
 * 진료과목·장비 목록은 번역 언어에서 버린다. 장비명은 사전으로 감당할 수 없는 열린
 * 집합이고, 그 내용은 이미 번역된 본문이 산문으로 다룬다. 카드는 빠른 참조용이므로
 * 숫자 하나가 남는 편이 한글 원문이 통째로 남는 것보다 낫다.
 */
const SPECIALISTS: Record<SupportedLang, (n: number) => string> = {
  ko: n => `전문의 ${n}명`,
  en: n => `${n} board-certified specialist${n === 1 ? '' : 's'}`,
  ja: n => `専門医 ${n}名`,
  'zh-CN': n => `专科医师 ${n} 名`,
  'zh-TW': n => `專科醫師 ${n} 名`,
  vi: n => `${n} bác sĩ chuyên khoa`,
  th: n => `แพทย์เฉพาะทาง ${n} คน`,
  ru: n => `Врачей-специалистов: ${n}`,
  es: n => `${n} especialista${n === 1 ? '' : 's'} certificado${n === 1 ? '' : 's'}`,
  'es-MX': n => `${n} especialista${n === 1 ? '' : 's'} certificado${n === 1 ? '' : 's'}`,
  'pt-BR': n => `${n} especialista${n === 1 ? '' : 's'} certificado${n === 1 ? '' : 's'}`,
  de: n => `${n} Fachärzt${n === 1 ? 'in/Facharzt' : 'e'}`,
  it: n => `${n} specialist${n === 1 ? 'a' : 'i'} certificat${n === 1 ? 'o' : 'i'}`,
};

export function localizeSpecialists(info: string, lang: SupportedLang): string | null {
  if (!info) return null;
  if (lang === 'ko') return info;
  const m = info.match(/전문의\s*(\d+)\s*명/);
  return m ? SPECIALISTS[lang](Number(m[1])) : null;
}

// ── 한글 로마자 표기 ────────────────────────────────────────────────────
/**
 * 병원명과 주소는 한글로 남긴다 — 지도 앱에 입력하거나 택시 기사에게 보여주려면
 * 그래야 한다. 다만 한글만 있으면 외국인 독자는 읽을 수도, 카드끼리 구분할 수도 없다.
 *
 * 음절만 기계적으로 바꾸면 `연세우리집치과의원`이 `Yeonseurijipchigwauiwon`이 되어
 * 오히려 고장난 것처럼 보인다. 병원명·주소의 어휘는 닫힌 집합이라(진료과목명,
 * 행정구역 단위, 층/역) 그 부분은 사전으로 옮기고 고유명사만 음절 변환한다.
 * 자음동화는 반영하지 않는다 — 발음 짐작과 지도 검색에는 이 정도로 충분하다.
 */
const ONSET = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const NUCLEUS = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const CODA = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

function syllables(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const i = code - 0xac00;
      out += ONSET[Math.floor(i / 588)] + NUCLEUS[Math.floor((i % 588) / 28)] + CODA[i % 28];
    } else out += ch;
  }
  return out;
}

/** 긴 것부터 매칭해야 한다 — `치과의원`이 `치과`보다 먼저. */
const TERMS: [string, string][] = [
  ['치과교정과치과의원', 'Orthodontic Dental Clinic'], ['치과교정과', 'Orthodontics'],
  ['치과의원', 'Dental Clinic'], ['치과병원', 'Dental Hospital'],
  ['성형외과의원', 'Plastic Surgery Clinic'], ['성형외과', 'Plastic Surgery'],
  ['피부과의원', 'Dermatology Clinic'], ['피부과', 'Dermatology'],
  ['한방병원', 'Korean Medicine Hospital'], ['한의원', 'Korean Medicine Clinic'],
  ['안과의원', 'Eye Clinic'], ['안과', 'Eye'],
  ['정형외과', 'Orthopedics'], ['신경외과', 'Neurosurgery'],
  ['대학교치과병원', 'University Dental Hospital'],
  ['의원', 'Clinic'], ['병원', 'Hospital'],
  ['특별자치시', ''], ['특별자치도', ''], ['광역시', ''], ['특별시', ''],
  ['층', 'F'],
];

/** 도로명 접미사는 뒤에 번지수나 공백이 올 때만 — `로로메디칼타워`가 잘리지 않게. */
const ROAD_SUFFIX: [string, string][] = [
  ['번길', 'beon-gil'], ['대로', '-daero'], ['로', '-ro'], ['길', '-gil'],
];

/** 행정구역 접미사는 토큰 끝에서만, 앞에 2음절 이상 있을 때만. */
const UNIT_SUFFIX: [string, string][] = [
  ['시', '-si'], ['구', '-gu'], ['군', '-gun'], ['읍', '-eup'], ['면', '-myeon'],
  ['동', '-dong'], ['역', ' Stn.'],
];
const MIN_STEM = 2;

export function romanize(text: string): string {
  if (!text) return '';
  let out = '';
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    const r = syllables(buffer);
    out += (out && !out.endsWith(' ') ? ' ' : '') + r.charAt(0).toUpperCase() + r.slice(1);
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const road = ROAD_SUFFIX.find(([ko]) => {
      if (!text.startsWith(ko, i)) return false;
      const next = text[i + ko.length];
      return next === undefined || /[\s0-9]/.test(next);
    });
    if (road && buffer.length >= MIN_STEM) {
      flush(); out += road[1]; i += road[0].length; continue;
    }

    const unit = UNIT_SUFFIX.find(([ko]) =>
      text.startsWith(ko, i) && (i + ko.length === text.length || /\s/.test(text[i + ko.length]))
    );
    if (unit && buffer.length >= MIN_STEM) {
      flush(); out += unit[1]; i += unit[0].length; continue;
    }

    const hit = TERMS.find(([ko]) => text.startsWith(ko, i));
    if (hit) {
      flush();
      const [ko, en] = hit;
      if (en) {
        const glue = en.startsWith('-') || en === 'F';
        out += glue ? en : (out && !out.endsWith(' ') ? ' ' : '') + en;
      }
      i += ko.length;
      continue;
    }

    const ch = text[i];
    if (/\s/.test(ch)) { flush(); out += ' '; i++; continue; }
    buffer += ch;
    i++;
  }
  flush();
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text || '');
}
