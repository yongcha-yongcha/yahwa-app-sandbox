// 야화 — 화면별 스크롤 위치 기억. 오버레이 네비게이션 구조상 상세 진입 시 목록이
// 언마운트되므로, 모듈 변수에 offset을 보관했다가 재마운트 때 복원한다.
// (오늘의친구 그리드에 먼저 적용했던 패턴의 공용화 — 모임/지도/커뮤니티 등)
const offsets = new Map<string, number>();

export function saveScroll(key: string, y: number): void {
  offsets.set(key, y);
}

export function getScroll(key: string): number {
  return offsets.get(key) ?? 0;
}

// ScrollView/FlatList 공용 — ref 콜백에 넘기면 마운트 직후 저장된 위치로 복원.
// FlatList는 scrollToOffset, ScrollView는 scrollTo를 사용.
export function restoreRef(key: string) {
  return (r: any) => {
    const y = getScroll(key);
    if (!r || y <= 0) return;
    setTimeout(() => {
      try {
        if (typeof r.scrollToOffset === 'function') r.scrollToOffset({ offset: y, animated: false });
        else if (typeof r.scrollTo === 'function') r.scrollTo({ y, animated: false });
      } catch { /* 레이아웃 전이면 무시 */ }
    }, 0);
  };
}

// 긴 FlatList용 복원 — 처음엔 몇 줄만 그려져 있어 바로 옮기면 내용 끝에서 멈췄다.
// 내용이 늘 때마다(onContentSizeChange) 그려진 끝까지 옮겨 다음 줄들이 그려지게 하고, 저장 위치에 닿거나 손으로 끌면 멈춘다.
// 화면(목록)마다 한 번 만들어 ref·onContentSizeChange·onScrollBeginDrag에 연결한다.
export function listRestore(key: string) {
  const target = getScroll(key);
  let list: any = null;
  let h = 0;
  let done = target <= 0;
  const go = () => {
    if (done || !list || h <= 0) return;
    try { list.scrollToOffset({ offset: Math.min(target, h), animated: false }); } catch { /* 레이아웃 전이면 무시 */ }
    if (h >= target) done = true;
  };
  return {
    ref: (r: any) => { list = r; if (r) setTimeout(go, 0); },
    onContentSizeChange: (_w: number, height: number) => { h = height; go(); },
    stop: () => { done = true; },
  };
}

// onScroll에 그대로 연결하는 저장 핸들러
export function saveScrollHandler(key: string) {
  return (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    saveScroll(key, e.nativeEvent.contentOffset.y);
  };
}
