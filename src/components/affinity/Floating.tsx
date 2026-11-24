// 야화 — 상대 프로필의 떠 있는 버튼 (리뉴얼 1120 · 시안 .profile-actions, spec-dating §3.3)
// 호감(왼쪽) · 편지(오른쪽) 56 원 · 아이콘 26 · 간격 12 · 그림자 roundBtn. 화면 오른쪽 20, 하단 메뉴 위 12.
// 호감: 보내기 전 = 진한 파랑 + 흰 선 하트 / 상대가 먼저 = 오른쪽 위 흰 원 20 + 장미 하트 / 보냄 = 회색 + 채운 하트(누를 수 없음) / 서로 = 장미 + 흰 채운 하트.
// 편지: 기본 = 흰 + 파랑 봉투 / 안 읽은 받은 편지 = 오른쪽 위 장미 점 12 / 보내고 기다림 = 회색 / 서로 연결 = 장미 + 흰 봉투.
// 호감을 처음 보낼 때 하트가 톡 튀어 올랐다 내려앉으며 채워진다(like-pop.js). 그 위에 화면 전체 완료 모션(ActionFeedback)이 겹친다.
import React, { useEffect, useReducer, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, ease, shadow } from '../../tokens';
import { NATIVE, reduceMotion, usePress } from '../../ui';
import { RIcons } from './icons';

export type HeartState = 'none' | 'incoming' | 'sent' | 'mutual';
export type LetterBtnState = 'default' | 'new' | 'sent' | 'conn';

const SIZE = 56;
const T = (v: Animated.Value, toValue: number, duration: number, easing: (t: number) => number = ease.out, delay = 0) =>
  Animated.timing(v, { toValue, duration, delay, easing, useNativeDriver: NATIVE });

// 흩어지는 작은 하트 6개 — 위쪽 150° 부채꼴로 26~42
const SPARKS = [0, 1, 2, 3, 4, 5].map((i) => {
  const deg = 195 + i * 30;   // 195° ~ 345°(위쪽)
  const r = 26 + ((i * 7) % 17);
  return { x: Math.cos((deg * Math.PI) / 180) * r, y: Math.sin((deg * Math.PI) / 180) * r, s: 8 + (i % 3) * 2 };
});

export function HeartFab({ state, disabled, onPress, popOnSend = true }: { state: HeartState; disabled?: boolean; onPress: () => void; popOnSend?: boolean }) {
  const done = state === 'sent' || state === 'mutual';
  const press = usePress(0.94);
  const settle = useRef(new Animated.Value(done ? 1 : 0)).current;   // 0 보내기 전(파랑 · 선 하트) → 1 보낸 뒤(회색/장미 · 채운 하트)
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;     // 하트 채워짐
  const squash = useRef(new Animated.Value(1)).current;
  const jump = useRef(new Animated.Value(0)).current;                // 0 → 1 꼭대기 → 0 내려앉음
  const spark = useRef(new Animated.Value(0)).current;
  const prev = useRef(done);
  const [, sync] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (done === prev.current) return;
    prev.current = done;
    // 애니메이션 없이 되돌릴 때는 한 번 더 그려 RN이 기억하는 값도 맞춘다(11-23, ScreenMotion snapBack 주석 참고)
    if (!done) { settle.setValue(0); fill.setValue(0); sync(); return; }
    if (!popOnSend || reduceMotion()) { Animated.parallel([T(settle, 1, 200), T(fill, 1, 200)]).start(); return; }
    spark.setValue(0);
    Animated.sequence([
      T(squash, 0.85, 160),
      Animated.parallel([
        T(squash, 1, 220),
        T(jump, 1, 220, Easing.bezier(0.2, 0.9, 0.3, 1)),
      ]),
      Animated.parallel([
        T(spark, 1, 620),
        Animated.spring(jump, { toValue: 0, bounciness: 9, speed: 9, useNativeDriver: NATIVE }),
        T(fill, 1, 420, ease.out, 84),
      ]),
      T(settle, 1, 260, ease.out, 260),
    ]).start();
  }, [done]);  // eslint-disable-line react-hooks/exhaustive-deps

  const mutual = state === 'mutual';
  const label = mutual ? '서로 호감이 있어요' : state === 'sent' ? '호감을 보냈어요' : state === 'incoming' ? '나도 호감 보내기' : '호감 보내기';
  return (
    <Pressable
      onPress={onPress} disabled={disabled || done} onPressIn={press.onPressIn} onPressOut={press.onPressOut}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || done }}
    >
      <Animated.View style={[{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center' }, shadow.roundBtn, { transform: [{ scale: Animated.multiply(squash, press.p.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion() ? 1 : 0.94] })) }] }]}>
        {/* 누르는 동안 한 단계 진한 바탕 / 보낸 뒤 바탕(회색 또는 장미) */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2, backgroundColor: colors.btnPrimaryPress, opacity: press.p }]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2, backgroundColor: mutual ? colors.love : colors.muted, opacity: settle }]} />
        {/* 흩어지는 작은 하트 */}
        {SPARKS.map((s, i) => (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', top: 4, opacity: spark.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: spark.interpolate({ inputRange: [0, 1], outputRange: [0, s.x] }) }, { translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [-16, -16 + s.y] }) }] }}>
            <RIcons.heartFill size={s.s} color={colors.love} />
          </Animated.View>
        ))}
        <Animated.View style={{ width: 26, height: 26, transform: [{ translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }, { scale: jump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }, { rotate: jump.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) }] }}>
          {/* 선 하트(보내기 전) → 장미 채움(튀어 오른 동안) → 자리 잡은 색 */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}><RIcons.heartLine size={26} color={colors.inverse} /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(fill, settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })) }]}><RIcons.heartFill size={26} color={colors.love} /></Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: settle }]}><RIcons.heartFill size={26} color={mutual ? colors.inverse : colors.subtle} /></Animated.View>
        </Animated.View>
        {/* 상대가 먼저 보낸 호감 */}
        {state === 'incoming' && (
          <View pointerEvents="none" style={{ position: 'absolute', right: -2, top: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(39,48,55,0.16)' }}>
            <RIcons.heartFill size={12} color={colors.love} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function LetterFab({ state, onPress }: { state: LetterBtnState; onPress: () => void }) {
  const press = usePress(0.94);
  const bg = state === 'conn' ? colors.love : state === 'sent' ? colors.muted : colors.surface;
  const fg = state === 'conn' ? colors.inverse : state === 'sent' ? colors.subtle : colors.accentStrong;
  const label = state === 'conn' ? '서로 나눈 편지 보기' : state === 'sent' ? '보낸 편지 보기' : state === 'new' ? '받은 편지 열기' : '편지 쓰기';
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, shadow.roundBtn, press.scaleStyle]}>
        <RIcons.envelope size={26} color={fg} />
        {state === 'new' && <View pointerEvents="none" style={{ position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.love }} />}
      </Animated.View>
    </Pressable>
  );
}

// 떠 있는 줄 — 오른쪽 20, 간격 12. 처음 나타날 때 4 아래에서 1초 페이드
export function FloatingActions({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => { T(v, 1, 1000).start(); }, [v]);
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom, flexDirection: 'row', gap: 12, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}
