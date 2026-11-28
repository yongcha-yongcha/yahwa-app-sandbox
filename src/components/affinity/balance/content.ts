// 오늘의 밸런스 — 오늘의 질문(샘플)과 그림. 질문을 바꾸려면 BALANCE_Q만 고치면 돼요.
// 그림(PIC)은 탕수육 질문용 샘플이라 다른 질문으로 바꾸면 pic을 null로 두세요(그림 없이 글자만 보여요).
// chip: 고른 쪽 칩 문구 — 홈 카드엔 "같이 {chip}", 프로필엔 "전 {chip}예요/이에요"(받침 있으면 '이에요')

export type BalanceSide = 'a' | 'b';
export type BalanceQuestion = {
  text: string;
  a: { label: string; sub: string; chip: string };
  b: { label: string; sub: string; chip: string };
  pctA: number;          // A를 고른 비율(시연용 샘플)
};

export const BALANCE_Q: BalanceQuestion = {
  text: '탕수육, 당신은?',
  a: { label: '부먹', sub: '소스를 부어서', chip: '부먹파' },
  b: { label: '찍먹', sub: '소스에 찍어서', chip: '찍먹파' },
  pctA: 62,
};

// "전 부먹파예요" / "전 아침형이에요" — 마지막 글자 받침으로 고른다
export function iAmChip(chip: string): string {
  const c = chip.charCodeAt(chip.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return `전 ${chip}${batchim ? '이에요' : '예요'}`;
}

// ── 그림(SVG 문자열) — 64칸 기준, 선은 각 쪽 잉크(A 하늘 700 · B 장미 700) ──
const FRY = '#EDD39C', FRY2 = '#D9B878', SAUCE = '#F2A98A', SAUCE2 = '#E58F6E', CARROT = '#E8805F', CUKE = '#9FC4B7', ONION = '#FFFDF6';
const wrap = (ink: string, s: number, body: string) => `<svg class="pic" width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const piece = (d: string, lines: string) => `<path d="${d}" fill="${FRY}"/><path d="${lines}" stroke="${FRY2}" stroke-width="1.3"/>`;

// 부먹 — 접시 위 튀김 세 조각에 소스가 흘러내리고, 위에서 소스 그릇이 붓는 중
const picA = (s = 64, ink = '#245D7E') => wrap(ink, s, `
  <ellipse cx="30" cy="50.5" rx="25.5" ry="7.6" fill="#fff"/>
  <ellipse cx="30" cy="49" rx="18.5" ry="4.6" stroke-opacity=".28"/>
  ${piece('M12.8 46.2c-.9-3.1 1.3-5.9 5.1-6.3 3.9-.4 6.3 1.4 6.3 4.2.1 2.7-2.3 4.3-5.6 4.4-3 .1-5.2-.8-5.8-2.3z', 'M15.6 46.4l1.4-.7M19.4 47.1l1.2-.5')}
  ${piece('M35.2 46.6c-.5-3 1.7-5.5 5.3-5.7 3.7-.2 6 1.7 5.8 4.4-.2 2.5-2.5 3.9-5.6 3.9-2.9 0-5.1-1.1-5.5-2.6z', 'M38 47.3l1.4-.5M42.6 47.2l1.1-.6')}
  ${piece('M22.4 44.9c-.7-3.6 2-6.6 6.3-6.8 4.4-.2 7 2.3 6.8 5.5-.2 3-3 4.6-6.8 4.6-3.4 0-5.8-1.3-6.3-3.3z', 'M25.6 45.8l1.6-.6M30.4 46.2l1.4-.5')}
  <path d="M13.6 43.6c2.2-2.7 6.4-3.4 9.4-2.3 2.4-3 8-3.6 11.2-.8 3.2-1.4 7.8-.4 8.8 2.5.6 1.7-1 2.6-2.5 1.7-.7 2.1-2.6 2.3-3.2-.2-1.5 1.7-3.4 1.5-3.8-.4-1.7 1.9-4.7 1.7-5.3-.4-1.3 1.7-3.2 1.5-3.6-.2-1.7 1.3-4.3.9-4.9-1.1-.8 1.2-2.6 1.4-3.4.4z" fill="${SAUCE}" fill-opacity=".9" stroke="${SAUCE2}" stroke-width="1.2"/>
  <path d="M24.4 40.4c1.8-.9 4-1 5.6-.2M36.6 41.6c1.1-.5 2.4-.5 3.4 0" stroke="#fff" stroke-width="1.3"/>
  <path d="M19 41.4l1.7-1.3 1.5 1.5-1.7 1.3z" fill="${CARROT}" stroke="none"/>
  <path d="M32.6 39.8l1.5-1.1 1.3 1.3-1.5 1.1z" fill="${CARROT}" stroke="none"/>
  <circle cx="27.4" cy="41.4" r="1.5" fill="${CUKE}" stroke="none"/>
  <circle cx="40.6" cy="42.4" r="1.3" fill="${CUKE}" stroke="none"/>
  <path d="M23.6 39.6c.8-.5 1.8-.5 2.4 0" stroke="${ONION}" stroke-width="1.4"/>
  <path d="M30.6 12.6c-1.9 6.2-2.6 14.4-1.6 24.6" stroke="${SAUCE}" stroke-width="2.8"/>
  <path d="M30.6 12.6c-1.9 6.2-2.6 14.4-1.6 24.6" stroke="${SAUCE2}" stroke-width=".8" stroke-opacity=".6"/>
  <path d="M25.6 30.6c0 1.3-.8 2.1-1.7 2.1s-1.7-.8-1.7-2.1c0-1.1 1.7-3 1.7-3s1.7 1.9 1.7 3z" fill="${SAUCE}" stroke="${SAUCE2}" stroke-width="1"/>
  <path d="M36 9.2 52.4 3c2.2 5.4-.6 11.6-6.4 13.1-5.2 1.3-9.1-1.4-10-6.9z" fill="#fff"/>
  <path d="M37.8 9.9 50.6 5.1" stroke="${SAUCE}" stroke-width="2.2"/>
  <path d="M36 9.2 30.4 12l5.4 1.1"/>
  <path d="M51.8 6.2c3.2-.4 4.6 3 2.2 4.9"/>
  <path d="M44.6 13.4c1.4-.2 2.6-.8 3.4-1.8" stroke-opacity=".35"/>`);

// 찍먹 — 종지에 담긴 소스, 젓가락으로 집은 조각의 아랫부분만 소스가 묻음, 옆 접시엔 바삭한 그대로 두 조각
const picB = (s = 64, ink = '#7D3749') => wrap(ink, s, `
  <ellipse cx="43" cy="51.6" rx="18.6" ry="5.8" fill="#fff"/>
  <ellipse cx="43" cy="50.6" rx="13" ry="3.4" stroke-opacity=".28"/>
  ${piece('M33.2 49.4c-.4-2.6 1.6-4.7 4.7-4.8 3.3-.1 5.1 1.6 4.9 3.8-.2 2.1-2.1 3.3-4.7 3.3-2.5 0-4.5-1-4.9-2.3z', 'M35.6 50l1.3-.5M38.8 50.3l1.1-.4')}
  ${piece('M42.6 48.8c-.3-2.4 1.7-4.3 4.5-4.4 3.1-.1 4.8 1.5 4.6 3.6-.2 1.9-2 3.1-4.4 3.1-2.3 0-4.3-.9-4.7-2.3z', 'M45 49.4l1.2-.5M48 49.6l1.1-.4')}
  <path d="M5.6 40.4c0 5.6 4.7 9.2 10.9 9.2s10.9-3.6 10.9-9.2" fill="#fff"/>
  <path d="M8.4 46.4c2.2 1.6 5 2.4 8.1 2.4" stroke-opacity=".28"/>
  <ellipse cx="16.5" cy="40.4" rx="10.9" ry="3.8" fill="#fff"/>
  <ellipse cx="16.5" cy="40.8" rx="8.6" ry="2.6" fill="${SAUCE}" stroke="${SAUCE2}" stroke-width="1"/>
  <path d="M10.6 40.2c1.5-.7 3.2-.8 4.6-.5" stroke="#fff" stroke-width="1.2"/>
  <path d="M21.2 42.2c1.4-.2 2.6-.6 3.4-1.2" stroke="${SAUCE2}" stroke-width="1" stroke-opacity=".7"/>
  <path d="M58.4 4.6 22.8 33.2" stroke-width="2.4"/>
  <path d="M61 8 25.6 35.6" stroke-width="2.4"/>
  <path d="M58.4 4.6 22.8 33.2M61 8 25.6 35.6" stroke="#E7D9BE" stroke-width="1"/>
  ${piece('M12.4 36.2c-.7-3.1 1.6-5.7 5.2-5.9 3.8-.2 6.1 1.8 5.9 4.7-.2 2.7-2.5 4.4-5.8 4.4-2.9 0-4.8-1.4-5.3-3.2z', 'M15.2 35.4l1.4-.6M18.6 34.6l1.2-.5')}
  <path d="M12.8 37.2c1.8 1.8 5.4 2.6 8.6 1.6 1.2-.4 2-1 2.4-1.8" stroke="${SAUCE}" stroke-width="3"/>
  <path d="M12.8 37.2c1.8 1.8 5.4 2.6 8.6 1.6 1.2-.4 2-1 2.4-1.8" stroke="${SAUCE2}" stroke-width=".9" stroke-opacity=".7"/>
  <path d="M8.6 42.4c2.4 1 5.2 1.3 7.6 1" stroke="${SAUCE2}" stroke-width="1" stroke-opacity=".55"/>`);

export const PIC: Record<BalanceSide, ((s?: number) => string) | null> = { a: picA, b: picB };

// 라벨 저울 — 고르면 고른 쪽으로 기울고 그쪽 접시가 채워져요
export function scaleIcon(pick: BalanceSide | '' = '', size = 16): string {
  const t = pick === 'a' ? 'rotate(-14 8 5)' : pick === 'b' ? 'rotate(14 8 5)' : '';
  const da = pick === 'a' ? 'translate(.15 1.21)' : pick === 'b' ? 'translate(.15 -1.21)' : '';
  const db = pick === 'a' ? 'translate(-.15 -1.21)' : pick === 'b' ? 'translate(-.15 1.21)' : '';
  return `<svg class="bal" width="${size}" height="${size}" viewBox="0 0 16 16"><path d="M8 2.5v11M5 13.5h6" stroke="#39444D" stroke-width="1.5" stroke-linecap="round"/><path transform="${t}" d="M2.5 5h11" stroke="#39444D" stroke-width="1.5" stroke-linecap="round"/><path transform="${da}" d="M1.2 9.2 3 5l1.8 4.2a1.8 1.8 0 0 1-3.6 0z" fill="${pick === 'a' ? '#4E8AB0' : 'none'}" stroke="#4E8AB0" stroke-width="1.4" stroke-linejoin="round"/><path transform="${db}" d="M11.2 9.2 13 5l1.8 4.2a1.8 1.8 0 0 1-3.6 0z" fill="${pick === 'b' ? '#C78693' : 'none'}" stroke="#C78693" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
