// 야화 UI 킷 — 인증번호 완료 모션(spec-shell §3-9 ②~⑤ · 시안 otp.js playSuccess, 디자이너 handoff/otp-success)
// 인증 확인이 성공하면 OtpInput 자리에 그린다. 칸 모양(56 · 모서리 12 · 사이 8 · 500 24)은 OtpInput과 같다.
// 숫자 사라짐 80 → 칸이 가운데로 360(in-out) → 동그라미 56(sky-100 → sky-600) 300 → 흰 체크 510(동그라미 끝 30 전)
// → "인증되었어요" 320(체크 끝 280 전, 아래 8에서) → 0.9초 머문 뒤 onFinish. 동작 줄이기: 칸 120 사라짐 → 동그라미·체크 200 → 문구.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../tokens';
import { NATIVE, reduceMotion } from './motion';

const M = { digit: 80, gather: 360, morph: 300, check: 510, text: 320, hold: 900, checkLead: 30, textLead: 280 };
const OUT = Easing.bezier(0.23, 1, 0.32, 1);
const IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const CELL_H = 56;
const GAP = 8;
const DONE = 56;
const CHECK_LEN = 17;   // M6 12 L10 16 L18 8 길이

export function OtpSuccess({ code, onFinish, length = 6, label = '인증되었어요', style }: {
  code: string; onFinish?: () => void; length?: number; label?: string; style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const [phase, setPhase] = useState<'cells' | 'done'>('cells');
  const digit = useRef(new Animated.Value(1)).current;
  const cellFade = useRef(new Animated.Value(1)).current;
  const gather = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current;
  const doneFade = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(CHECK_LEN)).current;
  const text = useRef(new Animated.Value(0)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;

  const cellW = width ? (width - GAP * (length - 1)) / length : 0;
  const offsets = useMemo(() => Array.from({ length }, (_, i) => width / 2 - (i * (cellW + GAP) + cellW / 2)), [width, cellW, length]);

  useEffect(() => {
    if (!width) return;   // 칸 너비를 잰 뒤 한 번만 재생
    Keyboard.dismiss();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };
    const run = (v: Animated.Value, toValue: number, duration: number, easing = OUT, native = NATIVE) =>
      Animated.timing(v, { toValue, duration, easing, useNativeDriver: native }).start();
    if (reduceMotion()) {
      run(cellFade, 0, 120, Easing.out(Easing.ease));
      after(120, () => {
        check.setValue(0);
        doneFade.setValue(0);
        morph.setValue(1);
        setPhase('done');
        run(doneFade, 1, 200, Easing.out(Easing.ease));
        run(text, 1, M.text);
        AccessibilityInfo.announceForAccessibility?.(label);
      });
      after(120 + M.text + M.hold, () => finish.current?.());
    } else {
      run(digit, 0, M.digit);
      after(M.digit, () => run(gather, 1, M.gather, IN_OUT));
      const tMorph = M.digit + M.gather;
      after(tMorph, () => { setPhase('done'); run(morph, 1, M.morph, OUT, false); });   // 너비·모서리·색이라 JS 드라이버
      const tCheck = tMorph + M.morph - M.checkLead;
      after(tCheck, () => run(check, 0, M.check, OUT, false));
      const tText = tCheck + M.check - M.textLead;
      after(tText, () => { run(text, 1, M.text); AccessibilityInfo.announceForAccessibility?.(label); });
      after(tText + M.text + M.hold, () => finish.current?.());
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0]);

  return (
    <View onLayout={(e) => { if (!width) setWidth(e.nativeEvent.layout.width); }} style={[{ height: CELL_H }, style]} accessible accessibilityLabel={phase === 'done' ? label : `인증번호 ${code}`}>
      {phase === 'cells' && width > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { flexDirection: 'row', gap: GAP, opacity: cellFade }]}>
          {Array.from({ length }).map((_, i) => (
            <Animated.View key={i} style={{ width: cellW, height: CELL_H, borderRadius: 12, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: gather.interpolate({ inputRange: [0, 1], outputRange: [0, offsets[i]] }) }] }}>
              <Animated.Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '500', color: colors.btnSecondaryFg, fontVariant: ['tabular-nums'], opacity: digit, transform: [{ scale: digit.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
                {code[i]}
              </Animated.Text>
            </Animated.View>
          ))}
        </Animated.View>
      )}
      {phase === 'done' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View style={{ opacity: doneFade }}>
            <Animated.View
              style={{
                width: morph.interpolate({ inputRange: [0, 1], outputRange: [cellW || DONE, DONE] }),
                height: DONE,
                borderRadius: morph.interpolate({ inputRange: [0, 1], outputRange: [12, DONE / 2] }),
                backgroundColor: morph.interpolate({ inputRange: [0, 1], outputRange: [colors.selected, colors.accentStrong] }),
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <CheckMark v={check} />
            </Animated.View>
          </Animated.View>
          <Animated.Text accessibilityLiveRegion="polite" style={{ position: 'absolute', top: CELL_H / 2 + DONE / 2 + 12, fontSize: 16, lineHeight: 24, fontWeight: '500', color: colors.btnSecondaryFg, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            {label}
          </Animated.Text>
        </View>
      )}
    </View>
  );
}

// 체크는 값을 듣고 Path에 숫자로 넘긴다(createAnimatedComponent(Path)는 웹에서 collapsable 콘솔 경고 — MyPage 링과 같은 방식).
// 매 프레임 바뀌는 숫자라 이 작은 부품 안에만 상태를 둔다 — 바깥(OtpSuccess)까지 프레임마다 다시 그리지 않게
function CheckMark({ v }: { v: Animated.Value }) {
  const [dash, setDash] = useState(CHECK_LEN);
  useEffect(() => {
    const id = v.addListener(({ value }) => setDash(value));
    return () => v.removeListener(id);
  }, [v]);
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24">
      <Path d="M6 12L10 16L18 8" fill="none" stroke={colors.inverse} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`} strokeDashoffset={dash} />
    </Svg>
  );
}
