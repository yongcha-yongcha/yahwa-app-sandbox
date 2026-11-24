// 야화 — 화면 전체 완료 모션 (리뉴얼 1120 · 시안 like-burst.js, spec-dating §3.4)
// 호감 · 편지를 보낸 순간 화면을 어두운 막(rgba(26,33,38,.58))으로 덮고, 세로 44% 지점에 흰 그림이 맺힌 뒤 글이 떠오른다.
//   호감: 흰 하트 100 + 작은 흰 하트 14개가 사방으로 흩어짐 · "호감을 보냈어요"(+ "리프 +N") · 1.4초 머묾
//   편지: 흰 선 봉투 92가 맺혔다가 720ms 뒤 오른쪽 위로 날아감 · 약 1.6초 머묾
// 막을 누르면 머무는 시간을 건너뛴다. 동작 줄이기면 막 · 글만 200ms로 나타났다 사라진다.
// 뒤 화면을 1.06배로 당기고 흐리는 효과는 넣지 않았다(전역 한 겹이라 뒤 화면을 건드리지 않는다 — 어두운 막만).
// 앱 전체에서 한 번만 마운트(app/_layout) — 어디서든 showActionFeedback({ kind, text, earned }).
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, ease } from '../tokens';
import { haptic, NATIVE, reduceMotion } from '../ui/motion';
import { ENVELOPE_HAND, HEART24 } from './affinity/icons';

export type ActionFeedbackKind = 'heart' | 'letter';
type Feedback = { kind: ActionFeedbackKind; text: string; earned: number; at: number };

let current: Feedback | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showActionFeedback(f: { kind: ActionFeedbackKind; text: string; earned?: number }) {
  current = { kind: f.kind, text: f.text, earned: f.earned ?? 0, at: Date.now() };
  emit();
}

function useFeedback() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => current,
    () => current,
  );
}

export function ActionFeedback() {
  const f = useFeedback();
  if (!f) return null;
  return <FeedbackView key={f.at} f={f} onDone={() => { if (current?.at === f.at) { current = null; emit(); } }} />;
}

// 흩어지는 작은 하트 14개(8~18) — 방향 · 거리 · 크기는 고정된 값(매번 같은 모양)
const BITS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.22 : -0.13);
  const r = 92 + ((i * 37) % 70);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r - 18, size: 8 + ((i * 5) % 11), ms: 900 + ((i * 53) % 400) };
});
// 봉투 뒤로 남는 흰 점 9개
const DOTS = Array.from({ length: 9 }, (_, i) => ({ t: (i + 1) / 10, size: 3 + (i % 3) }));
const tm = (v: Animated.Value, toValue: number, duration: number, delay = 0, easing: (t: number) => number = ease.out) =>
  Animated.timing(v, { toValue, duration, delay, easing, useNativeDriver: NATIVE });

function FeedbackView({ f, onDone }: { f: Feedback; onDone: () => void }) {
  const still = reduceMotion();
  const heart = f.kind === 'heart';
  const scrim = useRef(new Animated.Value(0)).current;
  const art = useRef(new Animated.Value(0)).current;      // 0 → 1 맺힘
  const artOut = useRef(new Animated.Value(0)).current;   // 사라짐
  const copy = useRef(new Animated.Value(0)).current;
  const copyOut = useRef(new Animated.Value(0)).current;
  const bits = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;      // 봉투: 0 → 1 내려앉음 → 2 날아감
  const leaving = useRef(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (hold.current) clearTimeout(hold.current);
    if (still) { Animated.parallel([tm(scrim, 0, 200), tm(copyOut, 1, 200)]).start(onDone); return; }
    Animated.parallel([
      tm(copyOut, 1, 160),
      tm(artOut, 1, 240, 0, Easing.bezier(0.55, 0, 0.75, 0.2)),
      tm(scrim, 0, 340, 80),
    ]).start(onDone);
  };

  useEffect(() => {
    haptic('success');
    if (still) {
      Animated.parallel([tm(scrim, 1, 200), tm(copy, 1, 200)]).start();
      hold.current = setTimeout(leave, 1400);
      return () => { if (hold.current) clearTimeout(hold.current); };
    }
    Animated.parallel([
      tm(scrim, 1, 300, 0, Easing.out(Easing.ease)),
      Animated.sequence([Animated.delay(80), Animated.spring(art, { toValue: 1, damping: 13, stiffness: 160, mass: 1, useNativeDriver: NATIVE })]),
      tm(copy, 1, 420, 200),
      heart ? tm(bits, 1, 1300, 120, Easing.out(Easing.cubic)) : Animated.sequence([Animated.delay(800), tm(fly, 1, 160), tm(fly, 2, 560, 0, Easing.bezier(0.5, 0, 0.75, 0.3))]),
    ]).start();
    hold.current = setTimeout(leave, 500 + (heart ? 1400 : 1600));
    return () => { if (hold.current) clearTimeout(hold.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const artOpacity = Animated.multiply(art.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), artOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const artScale = Animated.multiply(art.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] }), artOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 300, elevation: 30 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDeep, opacity: scrim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={leave} accessibilityLabel="닫기" />
      {/* 그림 — 세로 44% 지점 */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '44%', height: 0, alignItems: 'center', justifyContent: 'center' }}>
        {!still && heart && BITS.map((b, i) => (
          <Animated.View key={i} style={{ position: 'absolute', opacity: bits.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.9, 0] }), transform: [{ translateX: bits.interpolate({ inputRange: [0, 1], outputRange: [0, b.x] }) }, { translateY: bits.interpolate({ inputRange: [0, 1], outputRange: [0, b.y] }) }, { scale: bits.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.8] }) }] }}>
            <Svg width={b.size} height={b.size} viewBox="0 0 24 24" fill={colors.inverse}><Path d={HEART24} /></Svg>
          </Animated.View>
        ))}
        {!still && !heart && DOTS.map((d, i) => (
          <Animated.View key={i} style={{ position: 'absolute', width: d.size, height: d.size, borderRadius: d.size / 2, backgroundColor: colors.inverse, left: '50%', marginLeft: 120 * d.t, top: -190 * d.t, opacity: fly.interpolate({ inputRange: [1, 1 + d.t * 0.8, 1 + d.t * 0.8 + 0.1, 2], outputRange: [0, 0, 0.7, 0], extrapolate: 'clamp' }) }} />
        ))}
        {!still && (
          <Animated.View style={{ position: 'absolute', opacity: heart ? artOpacity : Animated.multiply(artOpacity, fly.interpolate({ inputRange: [0, 1, 1.8, 2], outputRange: [1, 1, 1, 0] })), transform: [
            { translateX: heart ? 0 : fly.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 120] }) },
            { translateY: heart ? 0 : fly.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 6, -190] }) },
            { rotate: heart ? '0deg' : fly.interpolate({ inputRange: [0, 1, 2], outputRange: ['0deg', '0deg', '-16deg'] }) },
            { scale: heart ? artScale : Animated.multiply(artScale, fly.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1, 0.42] })) },
          ] }}>
            {heart ? (
              <Svg width={100} height={100} viewBox="0 0 24 24" fill={colors.inverse}><Path d={HEART24} /></Svg>
            ) : (
              <Svg width={92} height={92} viewBox="0 0 24 24" fill="rgba(255,255,255,0.14)" stroke={colors.inverse} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"><Path d={ENVELOPE_HAND} /></Svg>
            )}
          </Animated.View>
        )}
      </View>
      {/* 글 — 그림 아래 */}
      <Animated.View
        pointerEvents="none"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{ position: 'absolute', left: 20, right: 20, top: '44%', marginTop: still ? -20 : 72, alignItems: 'center', opacity: Animated.multiply(copy, copyOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })), transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [still ? 0 : 8, 0] }) }] }}
      >
        <Text style={{ fontSize: 17, lineHeight: 23.8, fontWeight: '600', letterSpacing: -0.2, color: colors.inverse, textAlign: 'center' }}>{f.text}</Text>
        {f.earned > 0 && <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18.2, fontWeight: '500', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>리프 +{f.earned}</Text>}
      </Animated.View>
    </View>
  );
}
