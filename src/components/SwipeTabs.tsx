// 야화 — 상단 탭 좌우로 넘기기(시안 1020 대표 지시 2·11)
// · 손가락을 따라 화면이 옆으로 움직이고, 놓으면 다음/이전 탭으로 넘어가거나 제자리로 돌아온다.
//   가로로 14px 넘게, 세로보다 1.35배 넘게 움직일 때만 잡는다(시안 nt) — 세로 스크롤·가로 사진 넘기기와 겹치지 않게.
//   넘어가는 기준: 56px 이상 또는 빠르게 튕김.
// · 탭이 바뀌면(눌러도, 넘겨도) 내용은 바로 바뀐다(리뉴얼 1120 — 같은 화면 안 탭 전환은 움직임 없음). 끌던 자리는 제자리로.
// · 앱은 네이티브 드라이버(transform)로 움직인다. 웹은 세로 스크롤을 브라우저에 맡긴다(touch-action: pan-y).
import React, { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { Animated, PanResponder, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

const native = Platform.OS !== 'web';

export function SwipeTabs({ index, count, onIndexChange, children, style, enabled = true }: {
  index: number;                         // 지금 탭(0부터)
  count: number;                         // 탭 수
  onIndexChange: (i: number) => void;    // 넘겨서 탭이 바뀔 때
  children: React.ReactNode;             // 지금 탭의 화면
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;                     // 모달 등으로 잠시 끌 때
}) {
  const x = useRef(new Animated.Value(0)).current;
  const prev = useRef(index);
  const state = useRef({ index, count, onIndexChange, enabled });
  state.current = { index, count, onIndexChange, enabled };

  // 탭이 바뀌면 끌던 자리를 제자리로(새 내용은 움직임 없이 바로).
  // 되돌린 뒤 한 번 더 그려 RN이 기억하는 값도 0으로 맞춘다 — 탭이 바뀌며 그린 순간엔 끌던 거리가 기억값으로 남아,
  // 나중에 내용 높이가 바뀌면 iOS가 그 값을 다시 칠해 화면이 옆으로 밀린 채 굳을 수 있다(11-23, ScreenMotion snapBack 주석 참고)
  const [, sync] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    if (prev.current === index) return;
    prev.current = index;
    x.stopAnimation();
    x.setValue(0);
    sync();
  }, [index, x]);

  // 웹: 옆으로 끈 직후 손을 떼면 아래 카드가 눌린 것으로 처리되지 않게 그 한 번의 클릭을 막는다(시안 onClickCapture)
  const dragged = useRef(false);
  const boxRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = boxRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    // RN 웹의 onPress는 브라우저 click으로 불린다 — 잡는 단계(capture)에서 먼저 막는다
    const block = (e: Event) => { if (dragged.current) { dragged.current = false; e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener('click', block, true);
    return () => el.removeEventListener('click', block, true);
  }, []);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => { dragged.current = false; return false; },
    // 웹은 잡는 단계에서(아래 Pressable보다 먼저), 앱은 거품 단계에서 — 앱의 가로 스크롤(사진 넘기기 등)이 먼저 잡게
    [Platform.OS === 'web' ? 'onMoveShouldSetPanResponderCapture' : 'onMoveShouldSetPanResponder']:
      (_e: any, g: any) => state.current.enabled && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.35,
    onPanResponderGrant: () => { dragged.current = true; x.stopAnimation(); },
    onPanResponderMove: (_e, g) => {
      const { index: i, count: n } = state.current;
      // 맨 처음·맨 끝 탭에서 더 밀면 1/3만 따라온다
      const edge = (g.dx > 0 && i === 0) || (g.dx < 0 && i === n - 1);
      x.setValue(edge ? g.dx / 3 : g.dx);
    },
    onPanResponderRelease: (_e, g) => {
      const { index: i, count: n, onIndexChange: change } = state.current;
      const go = Math.abs(g.dx) >= 56 || Math.abs(g.vx) > 0.5;
      const next = go ? i + (g.dx < 0 ? 1 : -1) : i;
      if (next !== i && next >= 0 && next < n) { change(next); return; }
      Animated.spring(x, { toValue: 0, useNativeDriver: native, bounciness: 0, speed: 18 }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: native, bounciness: 0, speed: 18 }).start(); },
    onPanResponderTerminationRequest: () => true,
  })).current;

  return (
    <View
      style={[{ flex: 1, overflow: 'hidden' }, style]}
      {...pan.panHandlers}
      ref={boxRef}
    >
      <Animated.View style={[{ flex: 1, transform: [{ translateX: x }] }, Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as any) : null]}>
        {children}
      </Animated.View>
    </View>
  );
}
