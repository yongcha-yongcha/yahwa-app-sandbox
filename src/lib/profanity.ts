// 야화 — 욕설/비속어/음담패설 검열. 등록 시 해당 문구를 ***로 마스킹.
// 한국어(자모 변형 포함) + 영어 비속어를 커버. 완벽한 필터는 불가능하므로
// 자주 쓰이는 표현 위주 + 공백/특수문자 우회를 일부 흡수.
//
// 정책: 차단(등록 거부)이 아니라 마스킹(별표 치환) 후 등록.

// 마스킹 대상 단어 목록 (소문자/정규화 기준).
const BAD_WORDS: string[] = [
  // 한국어 비속어
  '시발', '씨발', '시방', '씨방', '시벌', '씨벌', '쉬발', '쒸발', '씨팔', '시팔', '씨바', '시바',
  '병신', '븅신', '빙신', '등신', '머저리',
  '지랄', '지롤', '존나', '존내', '졸라', '좃', '좆', '좇', '개좆',
  '개새끼', '개새기', '개색기', '개색끼', '새끼', '새꺄', '쌔끼', '썅', '쌍놈', '쌍년',
  '미친놈', '미친년', '미친새끼', '또라이', '돌아이',
  '닥쳐', '꺼져', '뒤져', '디져', '뒈져',
  '엿먹어', '염병', '엠병', '니미', '니애미', '니애비', '느금마', '느그애미', '패드립',
  '창녀', '걸레년', '보지', '자지', '잠지', '꼴려', '꼴리', '발정', '강간', '성기',
  '애미', '에미', '애비', '죽일년', '죽일놈',
  // 성적 표현 (대표 지시 0930) — 일상어와 겹치지 않는 긴 표현만 여기(느슨한 매칭)
  '섹스', '쎅스', '쌕스', '섹파', '섹드립', '원나잇', '원나이트', '폰섹', '몸캠', '벗방',
  '떡치자', '떡치고', '떡칠래', '떡침', '떡정', '따먹', '따묵', '딸딸이', '딸치', '야동',
  '사까시', '쓰리썸', '스리섬', '갱뱅', '조건만남', '성매매', '원조교제', '처녀막',
  '동정떼', '아다떼', '아다뗌', '젖꼭지', '음경', '음부', '박아줘', '빨아줘', '모텔가자', '텔가자',
  'sex', 'porn', 'nude', 'nudes', 'boobs', 'blowjob', 'horny', 'dildo', 'milf',
  // 영어 비속어
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard',
  'asshole', 'dickhead', 'cunt', 'pussy', 'slut', 'whore', 'retard', 'nigger', 'faggot',
  'cock', 'dick', 'wtf', 'stfu',
];

// 정규화: 우회를 흡수하기 위해 글자 사이 공백/특수문자 제거 후 매칭에 활용.
// 단, 원문 위치를 알아야 마스킹 가능 → 정규화 매칭으로 "포함 여부"만 보고
// 실제 마스킹은 원문에서 해당 단어를 느슨한 regex로 찾아 치환한다.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s.\-_*~^]/g, '');  // 시 발, 시.발, 시*발 같은 우회 흡수
}

// 한 단어에 대해, 글자 사이에 공백/특수문자가 끼어도 잡는 느슨한 regex 생성.
function loosePattern(word: string): RegExp {
  const sep = '[\\s.\\-_*~^]{0,2}';
  const body = word
    .split('')
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(sep);
  // 영어는 단어경계, 한국어는 경계 개념이 약하므로 그냥 전역 매칭
  const isAscii = /^[a-z]+$/i.test(word);
  return new RegExp(isAscii ? `\\b${body}\\b` : body, 'gi');
}

// 정규화한 단어도 미리 만들어 둔다(글·댓글마다 단어 140여 개를 다시 정규화하던 것, 1109)
const PATTERNS = BAD_WORDS.map((w) => ({ word: w, norm: normalize(w), re: loosePattern(w) }));

// 짧아서 일상어 속에 끼는 성적 표현 — 단어 첫머리일 때만 잡는다.
// 예) '아다'는 돌아다니다·찾아다·알아다 줄게에 들어 있고, 느슨한 매칭이면 "아 다 먹었어"도 걸린다.
// 앞 글자가 한글·영문·숫자가 아니어야(문장 처음·공백·기호 뒤) 매칭한다. 글자 사이 공백 우회는 허용하지 않는다.
const STRICT_WORDS: string[] = [
  '아다', '야스', '자위', '질싸', '입싸', '얼싸', '노콘', '펠라', '오랄', '발기', '야사', '꼴림',
];
const STRICT_PATTERNS = STRICT_WORDS.map((w) => ({
  word: w,
  re: new RegExp(`(^|[^가-힣a-z0-9])(${w})`, 'gi'),
}));

export type CensorResult = {
  text: string;       // 마스킹된 결과
  censored: boolean;  // 하나라도 마스킹됐는지
  count: number;      // 마스킹된 횟수
};

// 텍스트에서 비속어를 같은 길이의 *로 치환.
export function censorText(input: string): CensorResult {
  if (!input) return { text: input, censored: false, count: 0 };
  // 빠른 사전 체크 — 정규화 문자열에 포함된 단어가 없으면 원문 그대로
  const norm = normalize(input);
  const hits = PATTERNS.filter((p) => norm.includes(p.norm));
  const strictHits = STRICT_PATTERNS.filter((p) => input.includes(p.word));
  if (hits.length === 0 && strictHits.length === 0) return { text: input, censored: false, count: 0 };

  let count = 0;
  let out = input;
  for (const p of hits) {
    out = out.replace(p.re, (m) => {
      count += 1;
      // 공백/특수문자는 유지하고 글자만 *로
      return m.replace(/[^\s.\-_*~^]/g, '*');
    });
  }
  for (const p of strictHits) {
    out = out.replace(p.re, (_m, pre: string, w: string) => {
      count += 1;
      return pre + '*'.repeat(w.length);
    });
  }
  return { text: out, censored: count > 0, count };
}
