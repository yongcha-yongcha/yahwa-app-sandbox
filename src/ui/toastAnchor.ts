// 야화 UI 킷 — 알림 한 줄(토스트)이 뜰 높이(spec-shell §2.13)
// 토스트는 "지금 화면의 아래 고정 영역(주 버튼·입력 막대·하단 메뉴) 중 가장 높은 것보다 12 위"에 뜬다.
// 아래 고정 영역은 useToastAnchor(화면 아래 끝에서 그 영역 위쪽까지의 거리)로 알린다 — DockArea·Gnb는 이미 한다.
// 숨겨 둔 화면(KeepAlive)의 영역은 세지 않는다.
import { useEffect, useSyncExternalStore } from 'react';
import { useScreenActive } from '../components/KeepAlive';

const anchors = new Map<object, number>();
const subs = new Set<() => void>();
let top = 0;
function recompute() {
  let m = 0;
  anchors.forEach((v) => { if (v > m) m = v; });
  if (m !== top) { top = m; subs.forEach((f) => f()); }
}

export function useToastAnchor(height: number | null | undefined) {
  const active = useScreenActive();
  useEffect(() => {
    if (!active || !height) return;
    const key = {};
    anchors.set(key, height);
    recompute();
    return () => { anchors.delete(key); recompute(); };
  }, [active, height]);
}

// 가장 높은 아래 고정 영역의 높이(없으면 0)
export function useToastBottom(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => top, () => top);
}
