// 야화 UI 킷 — 버튼(spec-shell §2.1 · §3-3)
// 위계: primary(한 영역에 하나) · secondary · tertiary(흰 바탕 + 선) · text · danger(삭제) · gray(시트 취소).
// 크기: L 52 · M 44 · S 34(터치 44) · dock 54/14(화면 아래 주 버튼) · sheet 52/14(시트 2버튼) · welcome 59/17(명조 20).
// 누름: 0.97배(120ms) + 한 단계 진한 바탕(160ms, 진한 색 층을 겹쳐 opacity로). 꺼짐: 회색 바탕 + 회색 글자(투명도 쓰지 않음).
// loading: 색은 그대로 두고 글자 자리에 숨 쉬는 점 3개, 누름 막음. done: 이미 한 일(보조 색, 눌리지 않음).
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fontSerif, type as typo } from '../tokens';
import { Icon } from './icons';
import { BreathingDots, usePress } from './motion';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text' | 'danger' | 'gray';
export type ButtonSize = 'L' | 'M' | 'S' | 'dock' | 'sheet' | 'welcome';

const VARIANT: Record<ButtonVariant, { bg: string; fg: string; press: string; line?: string }> = {
  primary: { bg: colors.btnPrimaryBg, fg: colors.btnPrimaryFg, press: colors.btnPrimaryPress },
  secondary: { bg: colors.btnSecondaryBg, fg: colors.btnSecondaryFg, press: colors.btnSecondaryPress },
  tertiary: { bg: colors.btnTertiaryBg, fg: colors.btnTertiaryFg, press: colors.btnTertiaryPress, line: colors.btnTertiaryLine },
  text: { bg: 'transparent', fg: colors.btnTextFg, press: colors.btnTextPress },
  danger: { bg: colors.danger, fg: '#FFFFFF', press: colors.dangerPress },
  gray: { bg: colors.bgSoft, fg: colors.text, press: colors.muted },
};
const SIZE: Record<ButtonSize, { h: number; px: number; r: number; text: TextStyle; scale: number; block?: boolean }> = {
  L: { h: 52, px: 20, r: 12, text: typo.btnL, scale: 0.97 },
  M: { h: 44, px: 16, r: 12, text: typo.btnM, scale: 0.97 },
  S: { h: 34, px: 12, r: 10, text: typo.btnS, scale: 0.97 },
  dock: { h: 54, px: 20, r: 14, text: typo.btnDock, scale: 0.97, block: true },
  sheet: { h: 52, px: 16, r: 14, text: typo.btnL, scale: 0.97 },
  welcome: { h: 59, px: 19, r: 17, text: { fontFamily: fontSerif, fontWeight: '400', fontSize: 20, lineHeight: 30, letterSpacing: -0.6 }, scale: 0.985, block: true },
};

export function Button({
  label, children, variant = 'primary', size = 'L', block, disabled, loading, done, leftIcon, rightIcon, onPress, style, textStyle, accessibilityLabel, testID,
}: {
  label?: string;
  children?: React.ReactNode;      // label 대신 직접 넣을 내용
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;                 // 가득 찬 너비(dock·welcome은 기본)
  disabled?: boolean;
  loading?: boolean;
  done?: boolean;
  leftIcon?: React.ReactNode | ((color: string) => React.ReactNode);
  rightIcon?: React.ReactNode | ((color: string) => React.ReactNode);
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const sz = SIZE[size];
  const v = done ? VARIANT.secondary : VARIANT[variant];
  const press = usePress(sz.scale);
  const off = !!disabled && !done;
  const inert = off || !!loading || !!done;
  const isText = variant === 'text' && !done;
  const fg = off ? colors.btnDisabledFg : v.fg;
  const bg = off && !isText ? colors.btnDisabledBg : v.bg;
  const icon = (n: typeof leftIcon) => (typeof n === 'function' ? n(fg) : n);
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: !!loading }}
      hitSlop={size === 'S' ? { top: 5, bottom: 5 } : undefined}
      testID={testID}
      style={[{ alignSelf: block ?? sz.block ? 'stretch' : 'flex-start' }, style]}
    >
      <Animated.View
        style={[
          { height: sz.h, paddingHorizontal: isText ? (size === 'S' ? 8 : 12) : sz.px, borderRadius: sz.r, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
          press.scaleStyle,
        ]}
      >
        {/* 누르는 동안 한 단계 진한 바탕 */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: v.press, opacity: press.p }]} />
        {/* 테두리는 안쪽 1px(크기가 바뀌지 않게 덧씌운다) */}
        {!!v.line && !off && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: sz.r, borderWidth: 1, borderColor: v.line }]} />}
        {loading ? (
          <BreathingDots color={fg} />
        ) : (
          <>
            {icon(leftIcon)}
            {children ?? <Text numberOfLines={1} style={[sz.text, { color: fg }, textStyle]}>{label}</Text>}
            {icon(rightIcon)}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// 글자 링크(.text-link) — 높이 44 · 500 14 · 밑줄 1px(4 띄움). 누르면 글자색만 진하게
export function TextLink({ label, onPress, size = 14, color = colors.textSecondary, style }: { label: string; onPress?: () => void; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={[{ minHeight: 44, justifyContent: 'center', alignSelf: 'center' }, style]}>
      {({ pressed }) => (
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.lineMuted, paddingBottom: 3 }}>
          <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.4), fontWeight: '500', color: pressed ? colors.text : color }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// 닫기 원 버튼 — 터치 44 · 보이는 원 32 · X 20. 누르면 원이 한 단계 진해지며 0.94배
export function CloseButton({ onPress, label = '닫기' }: { onPress?: () => void; label?: string }) {
  const press = usePress(0.94);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.control, opacity: press.p }]} />
        <Icon name="close" size={20} color={colors.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}
