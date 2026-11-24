// 야화 — 커뮤니티 시각 표기(리뉴얼 1120, spec-rest §3.1 — 목록 · 글 · 댓글 공통)
// 오늘(서울 날짜)이면 "방금 전" → "N분 전" → "N시간 전", 날이 바뀌면 "11월 7일", 해가 다르면 "2025년 10월 16일".
const KST = 9 * 3600_000;
const day = (t: number) => { const d = new Date(t + KST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
export function siteAgo(iso: string | null | undefined, now: number = Date.now()): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const a = day(t);
  const b = day(now);
  if (a.y === b.y && a.m === b.m && a.d === b.d) {
    const min = Math.max(0, Math.floor((now - t) / 60_000));
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    return `${Math.floor(min / 60)}시간 전`;
  }
  return a.y === b.y ? `${a.m}월 ${a.d}일` : `${a.y}년 ${a.m}월 ${a.d}일`;
}

// 소식 · 교환 줄의 시간(§3.9): 오늘은 방금 · N분 전 · N시간 전 / 어제 / N일 전(7일 미만) / "M월 D일"
export function noticeAgo(t: number, now: number = Date.now()): string {
  if (!Number.isFinite(t)) return '';
  const a = day(t);
  const b = day(now);
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  if (days <= 0) {
    const min = Math.max(0, Math.floor((now - t) / 60_000));
    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    return `${Math.floor(min / 60)}시간 전`;
  }
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${a.m}월 ${a.d}일`;
}
// 소식 묶음(§3.9): 오늘 · 이번 주(7일 안) · 이전
export function noticeGroup(t: number, now: number = Date.now()): '오늘' | '이번 주' | '이전' {
  const a = day(t);
  const b = day(now);
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  return days <= 0 ? '오늘' : days < 7 ? '이번 주' : '이전';
}
