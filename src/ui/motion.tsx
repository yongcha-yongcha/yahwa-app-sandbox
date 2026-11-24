// 야화 UI 킷 — 모션 도우미(spec-shell §3). React Native Animated만 쓴다(transform·opacity는 네이티브 드라이버, 웹은 JS).
// · reduceMotion(): 기기의 '동작 줄이기' — 켜져 있으면 이동·크기 변화 없이 짧은 페이드 또는 바로 바뀜.
// · usePress(): 눌림(크기 + 진한 색 층) 한 벌. Rise: 단계 내용이 하나씩 떠오름(§3-1 f·g). FadeIn(§3-1 d). SlideSwap(§3-1 e).
// · BreathingDots: 불러오는 중 "숨 쉬는 점"(§3-12). haptic(): 안드로이드 진동만(expo-haptics는 다음 스토어 빌드).
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, Vibration, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, dur, ease } from '../tokens';

export const NATIVE = Platform.OS !== 'web';

let reduce = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduce = !!v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => { reduce = !!v; });
export function reduceMotion(): boolean { return reduce; }

export function haptic(kind: 'selection' | 'success' | 'impact' = 'selection') {
  if (Platform.OS === 'android') Vibration.vibrate(kind === 'selection' ? 4 : 14);
}

// 눌림 — p: 0(뗌) → 1(누름). scale 스타일은 누르는 대상에, p는 진한 색 층의 opacity에 건다
export function usePress(scale: number = 0.97, inMs: number = dur.press, outMs: number = dur.color) {
  const p = useRef(new Animated.Value(0)).current;
  const to = (v: number, ms: number) => Animated.timing(p, { toValue: v, duration: ms, easing: ease.out, useNativeDriver: NATIVE }).start();
  return {
    p,
    onPressIn: () => to(1, inMs),
    onPressOut: () => to(0, outMs),
    scaleStyle: { transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, reduce ? 1 : scale] }) }] },
  };
}

// 단계 내용 떠오름 — translateY 30 → 0(800ms 단계 스프링) + opacity 0 → 1(400ms). 지연 = base + min(index, cap) × 50ms.
// trigger가 바뀌면 다시 재생한다(같은 틀 안에서 내용만 바뀌는 가입 단계).
export function Rise({ index = 0, base = 100, cap = Infinity, rise = 30, trigger, style, children }: {
  index?: number; base?: number; cap?: number; rise?: number; trigger?: unknown;
  style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const y = useRef(new Animated.Value(reduce ? 0 : rise)).current;
  const o = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { y.setValue(0); o.setValue(1); return; }
    y.setValue(rise); o.setValue(0);
    const delay = base + Math.min(index, cap) * dur.riseStagger;
    const a = Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: dur.rise, delay, easing: ease.step, useNativeDriver: NATIVE }),
      Animated.timing(o, { toValue: 1, duration: dur.rise / 2, delay, easing: ease.out, useNativeDriver: NATIVE }),
    ]);
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

// 깊이가 같은 화면·내용이 바뀔 때 — opacity 0 → 1, 170ms
export function FadeIn({ trigger, ms = dur.fade, style, children }: { trigger?: unknown; ms?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const o = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { o.setValue(1); return; }
    o.setValue(0);
    const a = Animated.timing(o, { toValue: 1, duration: ms, easing: ease.out, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return <Animated.View style={[style, { opacity: o }]}>{children}</Animated.View>;
}

// 화면 안에서 내용만 바뀜 — translateX ±24 → 0 + opacity, 220ms. dir: 1 앞으로(오른쪽에서) · -1 뒤로 · 0 페이드만
export function SlideSwap({ trigger, dir = 1, style, children }: { trigger: unknown; dir?: 1 | -1 | 0; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: dur.swap, easing: ease.out, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 24, 0] }) }] }}>{children}</Animated.View>
    </View>
  );
}

// 숨 쉬는 점 3개 — opacity 1 → .3 → 1 + translateY 0 → −4 → 0, 1.2초 반복, 점마다 150ms 늦게
export function BreathingDots({ color = colors.accentMuted, size = 7, gap = 8 }: { color?: string; size?: number; gap?: number }) {
  const vs = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduce) return;
    const loops = vs.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(v, { toValue: 1, duration: 600, easing: ease.inOut, useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 600, easing: ease.inOut, useNativeDriver: NATIVE }),
      Animated.delay(300 - i * 150),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vs]);
  return (
    <View accessibilityLabel="불러오는 중" style={{ flexDirection: 'row', gap, alignItems: 'center', justifyContent: 'center' }}>
      {vs.map((v, i) => (
        <Animated.View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />
      ))}
    </View>
  );
}
