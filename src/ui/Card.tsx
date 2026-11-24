// 야화 UI 킷 — 카드 · 목록 줄(spec-shell §2.11 · spec-rest §2.2 · §6.1)
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../tokens';
import { Icon } from './icons';
import { usePress } from './motion';

// 회색 묶음 카드(최종 기본) — #F1F4F6 · 테두리·그림자 없음 · 모서리 16. 카드 사이 12.
// tone="notice": 안내 상자(#D6EAF8 · 모서리 10 · 안쪽 13) / "note": 옅은 안내(#ECF5FC · 모서리 14 · 안쪽 12) / "white": 흰 카드 + 노트 그림자
export function Card({ children, tone = 'gray', pad, style }: { children: React.ReactNode; tone?: 'gray' | 'notice' | 'note' | 'white'; pad?: number; style?: StyleProp<ViewStyle> }) {
  const s = tone === 'notice' ? { backgroundColor: colors.selected, borderRadius: 10, padding: pad ?? 13, ...shadow.notice }
    : tone === 'note' ? { backgroundColor: colors.accentSubtle, borderRadius: 14, padding: pad ?? 12 }
      : tone === 'white' ? { backgroundColor: colors.surface, borderRadius: radius.card, padding: pad ?? 16, ...shadow.note }
        : { backgroundColor: colors.bgSoft, borderRadius: radius.card, padding: pad ?? 0 };
  return <View style={[s, style]}>{children}</View>;
}

// 카드 버튼(.act-card) — 회색 카드 · 최소 64 · 안쪽 12 12 12 16 · 제목 600 15/22 + 한 줄 12/18 + 꺾쇠 20. 누름 #E3E7EA + 0.98배
export function ActionCard({ title, desc, onPress, left, style }: { title: string; desc?: string; onPress?: () => void; left?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const press = usePress(0.98);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" style={style}>
      <Animated.View style={[{ minHeight: 64, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: radius.card, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: press.p }]} />
        {left}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>{title}</Text>
          {!!desc && <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{desc}</Text>}
        </View>
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </Animated.View>
    </Pressable>
  );
}

// 목록 줄 — kind:
//  plain(마이페이지 .mp-list): 높이 52 · 아이콘 24 + 12 + 이름 15/21 400 + 값 13/18.2 #818C94 + 꺾쇠 20 #818C94. 바탕·구분선 없음.
//    누르면 좌우로 12 넓은 회색 박스(모서리 12)가 깔리며 줄 전체(박스 · 아이콘 · 글자)가 살짝 줄어든다(120ms)
//  group(묶음 카드 안 .fx-row): 좌우 16 · 위아래 15(한 줄 54) · 제목 15/24 + 보조 13/22.75 #69757E(위 4) · 줄 사이 1px 선(좌우 16 안쪽, 높이에 안 더함 · 첫 줄은 first)
//  icon(인증·지인 차단 .ip-row): 높이 56 · 좌우 16 · 아이콘 20 + 12 + 제목 15/21 500 + 아래 보조 12/17 #818C94
// right를 주면 값·꺾쇠 대신 그 요소(스위치 등). danger면 글자·아이콘 빨강.
export function Row({ label, sub, value, icon, right, chevron = true, onPress, kind = 'plain', first, danger, style }: {
  label: string; sub?: string; value?: string; icon?: React.ReactNode; right?: React.ReactNode; chevron?: boolean;
  onPress?: () => void; kind?: 'plain' | 'group' | 'icon'; first?: boolean; danger?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const press = usePress(kind === 'plain' ? 0.93 : 1, 120, 120);
  const fg = danger ? colors.danger : colors.text;
  const group = kind !== 'plain';
  const body = (
    <>
      {icon}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: kind === 'group' ? 24 : 21, fontWeight: kind === 'icon' ? '500' : '400', color: fg }}>{label}</Text>
        {!!sub && <Text style={kind === 'group' ? { marginTop: 4, fontSize: 13, lineHeight: 22.75, color: colors.sub } : { fontSize: 12, lineHeight: 17, color: colors.mute }}>{sub}</Text>}
      </View>
      {right ?? (
        <>
          {!!value && <Text style={{ fontSize: 13, lineHeight: 18.2, color: kind === 'icon' ? colors.textSecondary : colors.mute, fontWeight: kind === 'icon' ? '500' : '400' }}>{value}</Text>}
          {chevron && !!onPress && <Icon name="chevron-right" size={20} color={colors.mute} />}
        </>
      )}
    </>
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole={onPress ? 'button' : undefined} style={style}>
      {group ? (
        <View style={{ minHeight: kind === 'icon' ? 56 : 54, paddingHorizontal: 16, paddingVertical: kind === 'icon' ? 0 : 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted, opacity: press.p }]} />
          {/* 줄 사이 선 — 시안 .fx-row(box-shadow 0 -1px): 좌우 16 안쪽, 줄 높이에 더하지 않고 윗줄 마지막 1px에 겹친다 */}
          {!first && kind !== 'icon' && <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: -1, height: 1, backgroundColor: colors.line }} />}
          {body}
        </View>
      ) : (
        // 누르면 회색 박스와 아이콘·글자가 함께 줄어든다(11-22 — 예전엔 박스만 줄었다)
        <Animated.View style={[{ height: 52, marginHorizontal: -12 }, press.scaleStyle]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: colors.bgSoft, opacity: press.p }]} />
          <View style={{ flex: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{body}</View>
        </Animated.View>
      )}
    </Pressable>
  );
}

// 묶음 제목 — 13/20 600 #818C94 · 위 24 · 아래 8
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[{ marginTop: 24, marginBottom: 8, fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.mute }, style as any]}>{children}</Text>;
}
