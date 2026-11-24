// 야화 UI 킷 — 체크박스 · 약관 줄 · 라디오 · 그림 선택 카드 · 스위치(spec-shell §2.6~2.8)
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, ease, radius } from '../tokens';
import { Icon } from './icons';
import { NATIVE, usePress } from './motion';

// 체크박스 24 — 안 고름: 테두리만 #98A2AA / 고름: #4E8AB0 채움 + 흰 체크 / 일부: 채움 + 가로선
export function Checkbox({ checked, mixed, size = 24 }: { checked?: boolean; mixed?: boolean; size?: number }) {
  const on = !!checked || !!mixed;
  return (
    <View style={{ width: size, height: size }}>
      {/* 채운 아이콘은 체크·선이 뚫려 있다 — 뒤에 흰 면을 깔아 흰 체크로 보이게 */}
      {on && <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.2, right: size * 0.2, bottom: size * 0.2, backgroundColor: '#FFFFFF' }} />}
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Icon name={mixed && !checked ? 'square-minus' : on ? 'square-check' : 'square'} size={size} color={on ? colors.accent : colors.lineMuted} />
      </View>
    </View>
  );
}

// 약관 한 줄 — 체크박스 + 12 + 글자 14/22.4 · 위아래 16 · 아래 1px. 문서가 있으면 끝에 44×44 꺾쇠(눌러도 체크는 안 바뀐다).
// all: 맨 위 "전체 동의" 줄(15/24 600 · 아래 선 #CFD5DA)
export function TermsRow({ label, checked, mixed, onToggle, onOpen, all, style }: {
  label: string; checked: boolean; mixed?: boolean; onToggle: () => void; onOpen?: () => void; all?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: all ? colors.lineControl : colors.line }, style]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: mixed && !checked ? 'mixed' : checked }}
        accessibilityLabel={label}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}
      >
        <Checkbox checked={checked} mixed={mixed} />
        <Text style={all ? { flex: 1, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text } : { flex: 1, fontSize: 14, lineHeight: 22.4, color: colors.text }}>{label}</Text>
      </Pressable>
      {!!onOpen && (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${label} 내용 보기`} style={{ width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Icon name="chevron-right" size={20} color={colors.sub} />
        </Pressable>
      )}
    </View>
  );
}

// 라디오 20 — 빈 원 #98A2AA / 고름: #273037 바깥 원 + 가운데 점
export function Radio({ selected, size = 20, color }: { selected?: boolean; size?: number; color?: string }) {
  return <Icon name={selected ? 'radio-selected' : 'radio'} size={size} color={color ?? (selected ? colors.inverseStrong : colors.lineMuted)} />;
}

// 그림 선택 카드(성별 등) — 높이 71 · 모서리 12 · 안쪽 8. 기본 1px #CFD5DA / 고름 1.5px #273037 / 오류 1.5px #CF5C65 / 꺼짐 회색. 누름 0.96배(100ms)
export function ChoiceCard({ label, selected, error, disabled, art, onPress, style }: {
  label: string; selected?: boolean; error?: boolean; disabled?: boolean;
  art?: React.ReactNode | ((selected: boolean) => React.ReactNode);   // 왼쪽 그림(47×55)
  onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const press = usePress(0.96, 100, 100);
  const strong = !!selected || !!error;
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="radio" accessibilityState={{ selected: !!selected, disabled: !!disabled }} accessibilityLabel={label} style={[{ flex: 1 }, style]}>
      <Animated.View style={[{ height: 71, padding: 8, borderRadius: radius.field, backgroundColor: disabled ? colors.bgSoft : colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, press.scaleStyle]}>
        {!!art && <View style={{ opacity: disabled ? 0.4 : 1 }}>{typeof art === 'function' ? art(!!selected) : art}</View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Radio selected={selected} />
          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text }}>{label}</Text>
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius.field, borderWidth: strong ? 1.5 : 1, borderColor: selected ? colors.inverseStrong : error ? colors.errorLine : disabled ? colors.line : colors.lineControl }]} />
      </Animated.View>
    </Pressable>
  );
}

// 스위치 — 기본(알림 설정 .fx-switch): 40×24 · 손잡이 18 · 켜짐 #4E8AB0 · 200ms.
// tone="primary"(인연 공개 .ip-sw): 44×26 · 손잡이 20 · 켜짐 #377398 · 250ms Drawer. 꺼진 스위치는 40%
export function Switch({ value, onChange, disabled, tone = 'accent', accessibilityLabel }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean; tone?: 'accent' | 'primary'; accessibilityLabel?: string;
}) {
  const big = tone === 'primary';
  const w = big ? 44 : 40, h = big ? 26 : 24, knob = big ? 20 : 18, pad = 3;
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value ? 1 : 0, duration: big ? 250 : 200, easing: big ? ease.drawer : ease.out, useNativeDriver: NATIVE }).start();
  }, [value, v, big]);
  return (
    <Pressable onPress={() => onChange(!value)} disabled={disabled} hitSlop={10} accessibilityRole="switch" accessibilityState={{ checked: value, disabled: !!disabled }} accessibilityLabel={accessibilityLabel}>
      <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: colors.control, opacity: disabled ? 0.4 : 1, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: big ? colors.primary : colors.accent, opacity: v }]} />
        <Animated.View style={[{ width: knob, height: knob, borderRadius: knob / 2, backgroundColor: '#FFFFFF', marginLeft: pad, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, w - knob - pad * 2] }) }] }, big ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.15)' } : null]} />
      </View>
    </Pressable>
  );
}
