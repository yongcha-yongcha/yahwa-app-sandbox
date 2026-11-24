// 야화 — 화면 전환(리뉴얼 1120 · spec-shell §3-1, 시안 transitions.js)
// · 하단 메뉴 탭끼리: 애니메이션 없이 바로 바뀐다(KeepAlive가 숨겨 둔 화면을 그대로 보여 준다). 하단 메뉴 캡슐만 움직인다.
// · 안쪽으로 들어감(push): 새 화면 translateX 100% → 0 / 이전 화면 0 → −24% + opacity 1 → .72, 300ms Drawer
// · 뒤로 나옴(pop): 나가는 화면 0 → 100% / 드러나는 화면 −24% → 0 + .72 → 1, 280ms Drawer
// · 기기의 '동작 줄이기'가 켜져 있으면 바로 바뀐다.
// 쓰는 법: app/index가 <ScreenStack base={탭 화면} overlayKey={겹쳐 연 화면 이름} overlay={그 화면} />로 감싼다.
//   이미 지나온 화면 이름으로 가면 '뒤로'로 본다(시안 ie()). 같은 이름 안에서 내용만 바뀌면 전환하지 않는다 —
//   그때는 ui/motion의 SlideSwap(±24 + 페이드 220ms)이나 FadeIn(170ms)을 화면 안에서 쓴다.
// 움직이는 동안 화면이 틀 밖으로 나가 웹 문서 폭이 늘어나지 않게 바깥 틀이 잘라 준다(overflow: hidden).
// · 왼쪽 끝에서 밀어 뒤로(아이폰 · 11-22): swipeBack인 화면은 왼쪽 끝 24 안에서 시작해 오른쪽으로 끌면 손가락을 따라 밀려 나가고,
//   1/3 넘게 끌거나 빠르게 튕기면 onSwipeBack(뒤로), 아니면 제자리로. 바로 아래가 탭 화면이면 pop처럼 −24% · .72에서 따라 들어오고,
//   아래가 다른 겹친 화면이면(그 화면은 그려 두지 않는다) 빈 바탕이 보인다. 안드로이드는 시스템 뒤로 동작(BackHandler)이 맡는다.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Keep } from './KeepAlive';
import { colors, dur, ease } from '../tokens';
import { reduceMotion } from '../ui/motion';

const native = Platform.OS !== 'web';
type Shot = { key: string | null; el: React.ReactNode };
const EDGE = 24;   // 이 안에서 시작한 끌기만 뒤로 가기로 잡는다

export function ScreenStack({ base, overlayKey, overlay, swipeBack = false, onSwipeBack }: {
  base: React.ReactNode;            // 탭 화면(없애지 않고 아래에 둔다)
  overlayKey: string | null;        // 겹쳐 연 화면 이름(없으면 null)
  overlay: React.ReactNode;         // 그 화면
  swipeBack?: boolean;              // 지금 화면을 왼쪽 끝에서 밀어 닫을 수 있나(아이폰만)
  onSwipeBack?: () => void;         // 밀어 닫았을 때 — 화면의 뒤로 버튼과 같은 동작
}) {
  const { width: W } = useWindowDimensions();
  const p = useRef(new Animated.Value(1)).current;
  const prev = useRef<Shot>({ key: overlayKey, el: overlay });
  const hist = useRef<(string | null)[]>([null]);
  const trans = useRef<{ from: Shot; dir: 'push' | 'pop' } | null>(null);
  const [, redraw] = useState(0);
  const drag = useRef(new Animated.Value(0)).current;     // 위 화면이 밀린 거리(0 = 제자리)
  // 아래 탭 화면이 드러난 정도(0 = −24% · .72, 1 = 제자리). 아래 화면 틀에 늘 붙여 두고 쉴 때는 1로 둔다 —
  // 네이티브 드라이버는 움직임 연결을 떼어도 마지막 값을 되돌리지 않아서, 떼는 방식이면 탭 화면이 밀리고 흐린 채 굳었다(11-22)
  const reveal = useRef(new Animated.Value(1)).current;
  const [dragging, setDragging] = useState(false);
  const swiped = useRef(false);   // 밀어서 이미 나갔으면 뒤로 전환을 다시 돌리지 않는다
  const snapped = useRef(false);  // 덜 끌고 놓아 제자리로 돌아왔다 — 아래 화면 값을 쉬는 값(1)으로 되돌려야 한다

  if (prev.current.key !== overlayKey) {
    // 지나온 화면으로 가면 뒤로, 처음 가는 화면이면 안쪽으로
    const i = hist.current.lastIndexOf(overlayKey);
    const dir = i >= 0 ? 'pop' : 'push';
    hist.current = i >= 0 ? hist.current.slice(0, i + 1) : [...hist.current, overlayKey];
    trans.current = reduceMotion() || (swiped.current && dir === 'pop') ? null : { from: prev.current, dir };
    if (trans.current) p.setValue(0);
  }
  // 밀어서 나간 뒤 화면이 바뀌면 끌기 상태를 푼다(그리는 도중이 아니라 그린 직후에)
  useLayoutEffect(() => {
    if (!swiped.current) return;
    swiped.current = false;
    drag.setValue(0);
    reveal.setValue(1);
    setDragging(false);
  }, [overlayKey, drag, reveal]);

  // 덜 끌고 놓으면 제자리로 — 다 돌아온 뒤 아래 화면 값도 쉬는 값(1)으로.
  // 끝 콜백 안에서 setValue(1)을 하면 안 된다: RN은 네이티브 애니메이션의 끝 콜백을 부른 '뒤에' JS 값을 끝값(0)으로
  // 덮어쓰고 다시 그린다 → 화면은 1인데 RN이 기억하는 값은 0(−24% · .72)으로 남아, 나중에 탭 화면 크기가 바뀌면
  // iOS가 기억값을 다시 칠해 탭 화면이 흐리고 왼쪽으로 밀린 채 굳는다(11-23). 그래서 다 그린 뒤(아래 효과)에 되돌리고 다시 그린다.
  const snapBack = () => {
    const spring = (v: Animated.Value) => Animated.spring(v, { toValue: 0, useNativeDriver: native, bounciness: 0, speed: 18 });
    Animated.parallel([spring(drag), spring(reveal)]).start(() => { snapped.current = true; setDragging(false); });
  };
  useLayoutEffect(() => {
    if (dragging || !snapped.current) return;
    snapped.current = false;
    reveal.setValue(1);
    redraw((n) => n + 1);   // 기억값도 1로 맞춘다
  }, [dragging, reveal]);
  const live = useRef({ on: false, W, onSwipeBack });
  live.current = { on: Platform.OS === 'ios' && swipeBack && overlayKey !== null && !trans.current, W, onSwipeBack };
  const pan = useRef(PanResponder.create({
    // 시작 x는 moveX − dx(잡기 전엔 x0가 아직 0이다)
    onMoveShouldSetPanResponderCapture: (_e, g) => live.current.on && g.moveX - g.dx <= EDGE && g.dx > 10 && g.dx > Math.abs(g.dy) * 1.2,
    onPanResponderGrant: () => { snapped.current = false; drag.stopAnimation(); reveal.stopAnimation(); drag.setValue(0); reveal.setValue(0); setDragging(true); },
    onPanResponderMove: (_e, g) => {
      const x = Math.max(0, g.dx);
      drag.setValue(x);
      reveal.setValue(Math.min(1, x / live.current.W));
    },
    onPanResponderRelease: (_e, g) => {
      const { W: w, onSwipeBack: back } = live.current;
      if (back && (g.dx > w / 3 || (g.vx > 0.5 && g.dx > 0))) {
        const ms = Math.max(120, dur.pop * (1 - g.dx / w));
        Animated.parallel([
          Animated.timing(drag, { toValue: w, duration: ms, easing: ease.drawer, useNativeDriver: native }),
          Animated.timing(reveal, { toValue: 1, duration: ms, easing: ease.drawer, useNativeDriver: native }),
        ]).start(() => {
          swiped.current = true;
          back();
          // 뒤로가 막혀 화면이 그대로면(바뀌면 위에서 이미 풀린다) 제자리로 되돌린다
          setTimeout(() => { if (swiped.current) { swiped.current = false; drag.setValue(0); reveal.setValue(1); setDragging(false); } }, 50);
        });
      } else snapBack();
    },
    onPanResponderTerminate: () => snapBack(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  // 나가는 화면은 마지막으로 그렸던 모습 그대로 잠깐 더 보여 준다
  prev.current = { key: overlayKey, el: overlay };

  useLayoutEffect(() => {
    const t = trans.current;
    if (!t) return;
    Animated.timing(p, { toValue: 1, duration: t.dir === 'push' ? dur.push : dur.pop, easing: ease.drawer, useNativeDriver: native })
      .start(() => { if (trans.current === t) { trans.current = null; redraw((n) => n + 1); } });
  }, [overlayKey, p]);

  const t = trans.current;
  const push = t?.dir === 'push';
  // 위에 놓이는 화면(들어오는 화면·나가는 화면) / 아래에 깔리는 화면(밀려나는 화면·드러나는 화면)
  const over: ViewStyle | null = t ? ({ transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: push ? [W, 0] : [0, W] }) }] } as any) : null;
  const under: ViewStyle | null = t ? ({
    opacity: p.interpolate({ inputRange: [0, 1], outputRange: push ? [1, 0.72] : [0.72, 1] }),
    transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: push ? [0, -0.24 * W] : [-0.24 * W, 0] }) }],
  } as any) : null;

  // 끄는 중 — 위 화면은 손가락을 따라, 아래가 탭 화면이면 그 화면이 −24% · .72에서 따라 들어온다
  const dragOver: ViewStyle | null = dragging ? ({ transform: [{ translateX: drag }], shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: -2, height: 0 } } as any) : null;
  const baseUnder = dragging && hist.current[hist.current.length - 2] === null;
  const dragUnder: ViewStyle = {
    opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1], extrapolate: 'clamp' }),
    transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [-0.24 * W, 0], extrapolate: 'clamp' }) }],
  } as any;

  const baseMoving = !!t && (overlayKey === null || t.from.key === null);
  const leaving = t && t.from.key !== null ? t.from : null;
  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.bg }}>
      <Animated.View style={[StyleSheet.absoluteFill, baseMoving ? under : dragUnder]}>
        <Keep visible={overlayKey === null || baseMoving || baseUnder} active={overlayKey === null}>{base}</Keep>
      </Animated.View>
      {leaving && (
        <Animated.View key={leaving.key} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: push ? 1 : 2 }, push ? under : over]}>{leaving.el}</Animated.View>
      )}
      {overlayKey !== null && (
        <Animated.View key={overlayKey} {...pan.panHandlers} style={[StyleSheet.absoluteFill, { zIndex: push ? 2 : 1 }, t ? (push ? over : under) : dragOver]}>{overlay}</Animated.View>
      )}
    </View>
  );
}

// 화면 본문 틀 — 예전에는 화면이 바뀔 때 본문만 옆에서 8~14px 들어왔다. 지금은 화면 전체가 밀려 들어오므로(ScreenStack) 움직이지 않는다.
// 본문이 틀을 넘지 않게 잘라 주는 역할만 남긴다.
export function ScreenBody({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, overflow: 'hidden' }, style]}>{children}</View>;
}
