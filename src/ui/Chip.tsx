// 야화 UI 킷 — 칩 · 태그 · 배지 · 점(spec-shell §2.9 · §2.16)
import React from 'react';
import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../tokens';
import { Icon } from './icons';
import { usePress } from './motion';

// 선택 칩 — kind:
//  choice(공용·시트 안 선택지): 높이 36 · 모서리 18 · 좌우 14 · #F1F4F6 · 500 14 / 고름 #273037 + 흰 600
//  topic(질문 주제): 높이 32 · 모서리 16 · 좌우 12 · #F1F4F6(누름 #E3E7EA) · 600 12 #505C65 / 고름 #273037 + 흰 (시안 story-cards S1, 11-21)
//  case(사례·분류 알약): 높이 34 · 모서리 17 · 좌우 14 · #F1F4F6 · 500 13 #505C65 / 고름 #39444D + 흰 600
// 여러 개는 부모에서 flexDirection: 'row', flexWrap: 'wrap', gap: 8로 놓는다. 누름 0.96배
export function Chip({ label, selected, kind = 'choice', check, prefix, disabled, onPress, style }: {
  label: string; selected?: boolean; kind?: 'choice' | 'topic' | 'case'; check?: boolean; prefix?: string; disabled?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const press = usePress(0.96);
  const k = kind === 'topic'
    ? { h: 32, px: 12, fs: 12, fg: colors.textSecondary, bg: colors.bgSoft, on: colors.inverseStrong, line: false, press: colors.muted }
    : kind === 'case'
      ? { h: 34, px: 14, fs: 13, fg: colors.textSecondary, bg: colors.bgSoft, on: colors.text, line: false }
      : { h: 36, px: 14, fs: 14, fg: colors.text, bg: colors.bgSoft, on: colors.inverseStrong, line: false };
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }} style={style}>
      {({ pressed }) => (
      <Animated.View
        style={[
          { height: k.h, borderRadius: k.h / 2, paddingLeft: selected && check ? 10 : k.px, paddingRight: k.px, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: selected ? k.on : pressed && 'press' in k ? k.press : k.bg, borderWidth: k.line ? 1 : 0, borderColor: selected ? k.on : colors.lineControl, opacity: disabled ? 0.4 : 1 },
          press.scaleStyle,
        ]}
      >
        {selected && check && <Icon name="check" size={14} color="#FFFFFF" />}
        <Text style={{ fontSize: k.fs, lineHeight: Math.round(k.fs * 1.4), fontWeight: selected || kind === 'topic' ? '600' : '500', color: selected ? '#FFFFFF' : k.fg }}>{prefix}{label}</Text>
      </Animated.View>
      )}
    </Pressable>
  );
}

// 걸러짐 칩(시안 pref-region ③, 11-21) — 진회색 채움 · 앞 글자 흰 600 | 뒤 글자 하늘 600 · 오른쪽 ✕(20 원, 누르는 칸 넓게).
// 칩을 누르면 onPress(바꾸기), ✕를 누르면 onClear(빼기). sub가 없으면 앞 글자만(예: 세종)
export function FilterChip({ head, sub, onPress, onClear, clearLabel }: { head: string; sub?: string; onPress?: () => void; onClear: () => void; clearLabel: string }) {
  const press = usePress(0.96);
  // 칩 본체와 ✕는 나란한 두 버튼이다(버튼 안의 버튼은 웹에서 잘못된 구조) — 바탕 · 누름 크기는 바깥이 맡는다
  return (
    <Animated.View style={[{ height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inverseStrong }, press.scaleStyle]}>
      <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={sub ? `${head} ${sub}` : head} style={{ height: 36, paddingLeft: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#FFFFFF' }}>{head}</Text>
        {!!sub && <View style={{ width: 1, height: 12, marginHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.35)' }} />}
        {!!sub && <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.filterSub }}>{sub}</Text>}
      </Pressable>
      <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={clearLabel} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }} style={({ pressed }) => ({ marginLeft: 8, marginRight: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)' })}>
        <Icon name="close" size={12} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

// 작은 꼬리표 — tone:
//  dark("대표"): 높이 24 · 모서리 12 · 좌우 8 · 600 12 흰 · #273037
//  gold("쓰는 중 · N자"): 높이 24 · 모서리 12 · 600 11/16 · #F3EDDE + #6C582C
//  gray("나"·"글쓴이"): 높이 20 · 모서리 6 · 좌우 6 · 600 11 #505C65 · #F1F4F6
//  sky: #D6EAF8 + #245D7E(같은 크기는 gray)
export function Tag({ label, tone = 'gray', style }: { label: string; tone?: 'dark' | 'gold' | 'gray' | 'sky'; style?: StyleProp<ViewStyle> }) {
  const big = tone === 'dark' || tone === 'gold';
  const c = tone === 'dark' ? { bg: colors.inverseStrong, fg: '#FFFFFF' } : tone === 'gold' ? { bg: colors.goldSoft, fg: colors.goldInk } : tone === 'sky' ? { bg: colors.selected, fg: colors.btnSecondaryFg } : { bg: colors.bgSoft, fg: colors.textSecondary };
  return (
    <View style={[{ alignSelf: 'flex-start', height: big ? 24 : 20, borderRadius: big ? 12 : 6, paddingHorizontal: big ? 8 : 6, justifyContent: 'center', backgroundColor: c.bg }, style]}>
      <Text style={{ fontSize: tone === 'dark' ? 12 : 11, lineHeight: 16, fontWeight: '600', color: c.fg }}>{label}</Text>
    </View>
  );
}

// 개수 배지 — 18 정원 · #273037 · 흰 600 11
export function CountBadge({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inverseStrong }, style]}>
      <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{n}</Text>
    </View>
  );
}

// 알림 점 — 하단 메뉴·종 8(흰 링 1) / 탭 글자 옆 6 / 마음함 장미 점은 color={colors.love}
export function Dot({ size = 8, color = colors.badge, ring = 0, label = '새 소식 있음', style }: { size?: number; color?: string; ring?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  return <View accessibilityLabel={label} style={[{ width: size + ring * 2, height: size + ring * 2, borderRadius: (size + ring * 2) / 2, backgroundColor: color, borderWidth: ring, borderColor: '#FFFFFF' }, style]} />;
}
