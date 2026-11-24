// 야화 — 탭 안내가 가리킬 화면 요소 등록(시안 first-tour의 querySelector 대신)
// 화면 쪽은 대상 요소에 ref={tourRef('my.shortcuts')}만 붙인다. 안내는 measureInWindow로 위치를 잰다.
import type { View } from 'react-native';

export type TourTargetId =
  | 'profile.card'    // 인연 1단계 — 열린 카드(사진)
  | 'profile.like'    // 인연 2단계 — 호감 버튼
  | 'profile.letter'  // 인연 3단계 — 편지 버튼
  | 'community.write' // 커뮤니티 — 글쓰기 버튼
  | 'place.search'    // 플레이스 — 지도 검색 버튼
  | 'my.shortcuts';   // MY — 내 프로필 미리보기 · 프로필 편집

const nodes = new Map<TourTargetId, View>();
const refs = new Map<TourTargetId, (n: View | null) => void>();

// 같은 id에 늘 같은 함수를 돌려줘 다시 그릴 때 ref가 풀렸다 붙지 않게 한다
export function tourRef(id: TourTargetId) {
  let f = refs.get(id);
  if (!f) {
    f = (n: View | null) => { if (n) nodes.set(id, n); else nodes.delete(id); };
    refs.set(id, f);
  }
  return f as any;
}

export type Rect = { x: number; y: number; w: number; h: number };
export function measureTourTarget(id: TourTargetId): Promise<Rect | null> {
  const n = nodes.get(id) as any;
  if (!n?.measureInWindow) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      n.measureInWindow((x: number, y: number, w: number, h: number) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
    } catch { resolve(null); }
  });
}
