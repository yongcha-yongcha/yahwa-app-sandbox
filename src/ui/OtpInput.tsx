// 야화 UI 킷 — 인증번호 6칸(spec-shell §2.5 · §3-9)
// 칸 위에 투명 입력창 하나를 겹쳐 실제 입력을 받는다(숫자 키패드 · 문자 자동 입력). 그림 키패드는 만들지 않는다.
// 빈 칸: 흰 + 1px #CFD5DA / 지금 칸: 1.5px #377398 + 깜빡이는 커서 / 채운 칸: #D6EAF8 + 500 24 #245D7E / 오류: #FEDBDB + #B3434E, 줄 전체 흔들림.
// 다 채우면 240ms 뒤 onComplete. "맞음" 뒤의 원·체크 모션(§3-9 ②~⑤)은 가입 화면 쪽에서 얹는다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, ease } from '../tokens';
import { NATIVE, reduceMotion } from './motion';

export function OtpInput({ value, onChange, onComplete, error, length = 6, autoFocus, disabled, style }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: boolean; length?: number; autoFocus?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [focus, setFocus] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prevLen = useRef(value.length);

  // 틀림 — 줄 전체 0 → −6 → 6 → −4 → 0, 240ms
  useEffect(() => {
    if (!error || reduceMotion()) return;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 240, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [error, shake]);
  // 커서 — 1.06초 주기 켜짐/꺼짐
  useEffect(() => {
    if (!focus) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 0, useNativeDriver: NATIVE }), Animated.delay(530),
      Animated.timing(blink, { toValue: 0, duration: 0, useNativeDriver: NATIVE }), Animated.delay(530),
    ]));
    a.start();
    return () => a.stop();
  }, [focus, blink]);
  // 방금 들어간 숫자 — scale .8 → 1 + opacity .4 → 1, 120ms
  useEffect(() => {
    if (value.length > prevLen.current && !reduceMotion()) {
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: 120, easing: ease.out, useNativeDriver: NATIVE }).start();
    }
    prevLen.current = value.length;
    if (value.length === length && onComplete) {
      const t = setTimeout(() => onComplete(value), 240);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Animated.View style={[{ height: 56, transform: [{ translateX: shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -6, 6, -4, 0] }) }] }, style]}>
      <View pointerEvents="none" style={{ flexDirection: 'row', gap: 8, height: 56 }}>
        {Array.from({ length }).map((_, i) => {
          const ch = value[i];
          const cur = focus && !error && i === Math.min(value.length, length - 1) && value.length < length;
          const last = i === value.length - 1;
          return (
            <View key={i} style={{ flex: 1, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: error ? colors.dangerSoft : ch ? colors.selected : colors.surface, borderWidth: error || ch ? 0 : cur ? 1.5 : 1, borderColor: cur ? colors.focus : colors.lineControl }}>
              {ch ? (
                <Animated.View style={last ? { opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] } : null}>
                  <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '500', color: error ? colors.danger : colors.btnSecondaryFg, fontVariant: ['tabular-nums'] }}>{ch}</Text>
                </Animated.View>
              ) : cur ? (
                <Animated.View style={{ width: 1.5, height: 24, backgroundColor: colors.focus, opacity: blink }} />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        accessibilityLabel={`인증번호 ${length}자리`}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent', fontSize: 16 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
    </Animated.View>
  );
}
