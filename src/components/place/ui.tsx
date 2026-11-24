// 야화 — 쿠폰함 묶음 공용 부품(리뉴얼 1120 · spec-rest §4): 작은 버튼 · 분류 칩 · 정보 표 · 회색 안내 상자 · 점선 · 티켓
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontSerif, radius } from '../../tokens';
import { usePress } from '../../ui';

// 작은 글(.fx-coupon small · 분류 줄) — 13/22.75 글자-안내
export const smallText = { fontSize: 13, lineHeight: 22.75, color: colors.sub } as const;

// 작은 버튼(.fx-small) — 높이 44 · 모서리 12 · 14/21. primary: 쿠폰 받기 / white: 회색 카드 위 / gray: 흰 바탕 위
const TONE = {
  primary: { bg: colors.btnPrimaryBg, fg: colors.btnPrimaryFg, press: colors.btnPrimaryPress },
  white: { bg: colors.surface, fg: colors.inverseStrong, press: colors.muted },
  gray: { bg: colors.bgSoft, fg: colors.inverseStrong, press: colors.muted },
} as const;
//  r: 모서리(매장 카드 안 두 버튼은 시안 11)
export function PlaceButton({ label, tone = 'gray', disabled, onPress, style, r = radius.field }: {
  label: string; tone?: keyof typeof TONE; disabled?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>; r?: number;
}) {
  const press = usePress();
  const c = TONE[tone];
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={style}>
      <Animated.View style={[{ height: 44, paddingHorizontal: 13, borderRadius: r, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.press, opacity: press.p }]} />
        <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 21, color: c.fg }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// 분류 칩(#fx-place-tabs) — 높이 40 · 좌우 14 · 12/15.6(자간 −0.5). 고른 것: 진회색 + 흰 600
export function CatChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const press = usePress(0.96);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="tab" accessibilityState={{ selected }}>
      <Animated.View style={[{ height: 40, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: selected ? colors.inverseStrong : colors.bgSoft }, press.scaleStyle]}>
        <Text style={{ fontSize: 12, lineHeight: 15.6, letterSpacing: -0.5, fontWeight: selected ? '600' : '500', color: selected ? colors.inverse : colors.textSecondary }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// 정보 표(.fx-shop-details) — 줄마다 [이름 66 · 13/22.1 글자-연 | 12 | 값 13/22.1 글자-진], 위아래 12, 아래 1px 선.
//  inCard: 쿠폰 카드 안(위 18 + 1px 선 + 8, 아래 18)
export type DetailRow = { label: string; value: React.ReactNode };
export function DetailRows({ rows, inCard }: { rows: DetailRow[]; inCard?: boolean }) {
  if (!rows.length) return null;
  return (
    <View style={inCard ? { marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line } : null}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ width: 66, fontSize: 13, lineHeight: 22.1, color: colors.mute }}>{r.label}</Text>
          <View style={{ flex: 1 }}>
            {typeof r.value === 'string' ? <Text style={{ fontSize: 13, lineHeight: 22.1, color: colors.text }}>{r.value}</Text> : r.value}
          </View>
        </View>
      ))}
    </View>
  );
}

// 회색 안내 상자(.fx-note) — 회색 카드 · 모서리 14 · 안쪽 12 · 13/22.75 글자-안내
export function Note({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.bgSoft, borderRadius: radius.cta, padding: 12 }, style]}>
      <Text style={smallText}>{children}</Text>
    </View>
  );
}

// 점선(가로 · 세로) — RN은 한쪽 변만 점선이 안 되는 기기가 있어, 점선 네모를 그리고 한 변만 보이게 자른다
export function DashedLine({ vertical, color = colors.lineControl, w = 1.5, style }: { vertical?: boolean; color?: string; w?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[vertical ? { width: w } : { height: w }, { overflow: 'hidden' }, style]}>
      <View style={[{ position: 'absolute', borderWidth: w, borderColor: color, borderStyle: 'dashed', borderRadius: 1 }, vertical ? { top: -w, bottom: -w, left: 0, width: w * 4 } : { left: -w, right: -w, top: 0, height: w * 4 }]} />
    </View>
  );
}

// 큰 티켓(시안 coupon-box .ticket) — 회색 카드 · 모서리 20. 윗칸(안쪽 20 · 아래 18) → 점선 + 양옆 홈(지름 20, 화면 바탕색) → 아랫칸(14 · 20 · 16).
//  쿠폰이 주인공인 자리(매장 혜택 · 쿠폰 자세히 · 직원 확인)에만 쓴다. bottom이 없으면 점선 없이 윗칸만.
export function Ticket({ top, bottom, style }: { top: React.ReactNode; bottom?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ borderRadius: radius.photo, backgroundColor: colors.bgSoft, overflow: 'hidden' }, style]}>
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: bottom ? 18 : 20 }}>{top}</View>
      {!!bottom && (
        <>
          <View style={{ height: 1.5, justifyContent: 'center' }}>
            <DashedLine style={{ marginHorizontal: 18 }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: -10, top: -9.25, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg }} />
            <View pointerEvents="none" style={{ position: 'absolute', right: -10, top: -9.25, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg }} />
          </View>
          <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 16, gap: 4 }}>{bottom}</View>
        </>
      )}
    </View>
  );
}

// 티켓 아랫칸 한 줄 — [이름 58 · 13/22 글자-연 | 12 | 값 13/22 글자-진]
export function TicketRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ width: 58, fontSize: 13, lineHeight: 22, color: colors.mute }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 22, color: colors.text }}>{children}</Text>
    </View>
  );
}

// 티켓 혜택 글(명조 21/32)
export const ticketTitle = { fontFamily: fontSerif, fontSize: 21, lineHeight: 32, color: colors.inverseStrong } as const;
