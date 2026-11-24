// 자기소개(기본 소개 · 이야기 카드)에 의미 없는 글을 걸러낸다 — 'ㅏㅏㅏ ㅇㅇㅇ', '아아아아아…', '가나가나가나…', '!!!!…'
// 앱 화면에서만 막는다(서버 검사 없음). 'ㅎㅎ' · 'ㅋㅋ' · '하하하' 정도는 자연스러운 말투라 조금 섞이면 통과.
const JAMO = /[ᄀ-ᇿㄱ-ㆎ]/u;   // 자음·모음만 따로 쓴 글자
const LETTER = /\p{L}/u;

// 문제가 있으면 고칠 방법을 알려 주는 문구, 없으면 null
export function storyIssue(text: string): string | null {
  const letters = [...text].filter((c) => LETTER.test(c));
  if (letters.length < 10) return '숫자나 기호 말고 글로 적어 주세요';

  // 자음·모음 낱자 + 같은 글자가 3번을 넘겨 연달아 나온 몫이 글자의 30% 이상
  let noise = 0;
  let run = 1;
  letters.forEach((c, i) => {
    run = i > 0 && c === letters[i - 1] ? run + 1 : 1;
    if (JAMO.test(c) || run > 3) noise++;
  });
  if (noise / letters.length >= 0.3) return '자음·모음만 쓰거나 같은 글자를 반복한 부분을 고쳐 주세요';

  // 서로 다른 글자가 너무 적다(같은 말 되풀이)
  if (new Set(letters).size < 6) return '같은 말을 되풀이하지 말고 이야기처럼 적어 주세요';

  // 한글 음절 모양으로 본다(질문 예시 120개 기준 — 정상 문장은 한 초성이 많아야 50%, 받침 있는 글자가 적어도 16%)
  // · 한 초성으로만 이어 쓴 글('아이우에오…', '가거고구기…')
  // · 받침 없이 쉬운 글자만 늘어놓은 글('아이에이오우야…부비바꾸꾸또또', '가나다라마바사…')
  const syl = letters.filter((c) => c >= '가' && c <= '힣').map((c) => c.charCodeAt(0) - 0xac00);
  if (syl.length >= 10) {
    const onsets = syl.map((k) => Math.floor(k / 588));
    const top = Math.max(...[...new Set(onsets)].map((o) => onsets.filter((x) => x === o).length));
    const finals = syl.filter((k) => k % 28 !== 0).length;
    if (top / syl.length >= 0.7 || finals / syl.length < 0.1) return '뜻이 통하는 문장으로 적어 주세요';
  }
  return null;
}
