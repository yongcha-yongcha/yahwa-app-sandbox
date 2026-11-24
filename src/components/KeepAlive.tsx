// 야화 — 화면을 없애지 않고 숨겨 두기(1110 잔렉 개선)
// 예전엔 탭을 바꾸거나 글·프로필을 열 때마다 탭 화면을 통째로 없앴다가 돌아올 때 처음부터 다시 그렸다
// (인연 덱·커뮤니티 목록·지도가 매번 새로 만들어져 돌아올 때마다 버벅였다).
// 이제 한 번 그린 탭 화면은 그대로 두고 화면 밖으로만 옮긴다 — 돌아오면 스크롤·덱 자리까지 그대로 바로 보인다.
// 숨기는 방법은 React Navigation(ResourceSavingView)과 같다: 크기는 그대로 두고 위치만 멀리(잘리는 틀 안에서) 보낸다.
//   display: none 은 쓰지 않는다 — 웹은 스크롤 자리를 잃고 크기 0이 되어 onLayout이 다시 불린다.
// · useScreenActive(): 지금 이 화면이 보이는 중인지. 숨은 동안 하면 안 되는 일(첫 방문 안내·읽음 처리·소리)을 막는 데 쓴다.
// · useOnScreenInactive(fn): 화면이 가려질 때 한 번 — 예전에 화면이 없어지며 같이 닫히던 모달을 닫는다.
import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

// 보이는 중인지는 값이 아니라 '구독할 수 있는 상자'로 내려보낸다 — 화면 전체가 아니라 필요한 곳만 다시 그려지게.
// (값을 그대로 내려보내면 탭을 바꿀 때마다 그 값을 읽는 화면 전체가 다시 그려진다)
type ActiveStore = { get: () => boolean; subscribe: (cb: () => void) => () => void; set: (v: boolean) => void };
function makeStore(initial: boolean): ActiveStore {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    set: (v) => { if (v === value) return; value = v; subs.forEach((f) => f()); },
  };
}
const ALWAYS = makeStore(true);
const ActiveContext = createContext<ActiveStore>(ALWAYS);

// 지금 이 화면이 보이는 중인지 — 바뀌면 이 훅을 쓴 컴포넌트만 다시 그려진다(작은 컴포넌트에서만 쓴다)
export function useScreenActive(): boolean {
  const store = useContext(ActiveContext);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// 보이는 상태가 바뀔 때 부른다(다시 그리지 않는다)
export function useOnScreenActiveChange(fn: (active: boolean) => void) {
  const store = useContext(ActiveContext);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => store.subscribe(() => ref.current(store.get())), [store]);
}

export function useOnScreenInactive(fn: () => void) {
  useOnScreenActiveChange((active) => { if (!active) fn(); });
}

const FAR = 30000;  // 화면 밖으로 충분히 먼 거리

// active: 화면은 아직 보이지만(화면 전환으로 밀려 나가는 중) 이미 '안 보는 화면'으로 칠 때 false를 준다 — 기본은 visible과 같다
export function Keep({ visible, active = visible, children }: { visible: boolean; active?: boolean; children: React.ReactNode }) {
  const parentActive = useScreenActive();
  const on = visible && active && parentActive;
  const store = useRef<ActiveStore | null>(null);
  if (!store.current) store.current = makeStore(on);
  useEffect(() => { store.current!.set(on); }, [on]);
  // 숨기는 동안에는 마지막으로 보이던 크기에 묶어 둔다 — 키보드가 올라와 화면 높이가 바뀌어도
  // 숨겨 둔 화면까지 다시 배치(덱 높이 재계산·목록 재배치)되지 않게
  const size = useRef<{ w: number; h: number } | null>(null);
  const hidden = size.current
    ? [styles.frozen, { width: size.current.w, height: size.current.h }]
    : styles.hidden;
  return (
    <ActiveContext.Provider value={store.current}>
      <View
        pointerEvents={visible && active ? 'auto' : 'none'}
        accessibilityElementsHidden={!(visible && active)}
        importantForAccessibility={visible && active ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!(visible && active)}
        onLayout={(e) => { if (visible) size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
        style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      >
        <View
          collapsable={false}
          pointerEvents={visible ? 'auto' : 'none'}
          style={visible ? styles.shown : hidden}
        >
          {children}
        </View>
      </View>
    </ActiveContext.Provider>
  );
}

// 웹은 transform으로 옮긴다 — top을 바꾸면 브라우저가 숨기는 화면 전체의 배치를 다시 계산한다
const styles = StyleSheet.create({
  shown: { flex: 1 },
  hidden: Platform.OS === 'web' ? { flex: 1, transform: [{ translateY: FAR }] } : { flex: 1, top: FAR },
  frozen: Platform.OS === 'web'
    ? { position: 'absolute', left: 0, top: 0, transform: [{ translateY: FAR }] }
    : { position: 'absolute', left: 0, top: FAR },
});

// 하단 탭 화면들 — 한 번 들어간 탭은 그대로 두고 숨기기만 한다.
// keep(k)가 false인 탭은 예전처럼 보일 때만 그린다(떠나거나 다른 화면이 덮으면 없앤다).
export function KeepTabs<K extends string>({ active, order, screens, keep }: {
  active: K;
  order: K[];
  screens: Partial<Record<K, React.ReactNode>>;
  keep: (k: K) => boolean;
}) {
  const shown = useScreenActive();
  const visited = useRef(new Set<K>()).current;
  visited.add(active);
  return (
    <View style={{ flex: 1 }}>
      {order.map((k) => {
        const kept = keep(k);
        const mounted = k === active ? kept || shown : kept && visited.has(k);
        if (!mounted) return null;
        return <Keep key={k} visible={k === active}>{screens[k]}</Keep>;
      })}
    </View>
  );
}
