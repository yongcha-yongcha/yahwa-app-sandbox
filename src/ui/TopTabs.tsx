// 야화 UI 킷 — 화면 안 밑줄 탭(spec-shell §2.10 · 마음함 "보낸·받은·서로" · 커뮤니티 "전체·공감순·내 글")
// 높이 44(커뮤니티 41) · 왼쪽부터 · 탭 사이 20 · 각 최소 폭 44 · 15/21 600. 고른 탭 #273037 + 밑줄 2(탭 폭만큼), 나머지 #98A2AA.
// line: 줄 맨 아래 1px 선(#E3E7EA, 화면 폭 전체 — 좌우 여백은 padX로). 새 소식은 글자 오른쪽 위 점.
// 내용 좌우 넘김은 components/SwipeTabs를 그대로 쓴다(이 컴포넌트는 머리만).
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../tokens';
import { Dot } from './Chip';

export type TabItem<K extends string> = { key: K; label: string; dot?: boolean };

export function TopTabs<K extends string>({ items, value, onChange, height = 44, line, padX = 20, dotColor = colors.love, dotSize = 5, style }: {
  items: TabItem<K>[]; value: K; onChange: (k: K) => void; height?: number; line?: boolean; padX?: number; dotColor?: string; dotSize?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessibilityRole="tablist" style={[{ height, flexDirection: 'row', gap: 20, paddingHorizontal: padX, borderBottomWidth: line ? 1 : 0, borderBottomColor: colors.line }, style]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.dot ? `${it.label}, 새 소식 있음` : it.label} style={{ minWidth: 44, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <View>
              <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: on ? colors.inverseStrong : colors.subtle }}>{it.label}</Text>
              {it.dot && <Dot size={dotSize} color={dotColor} style={{ position: 'absolute', right: -dotSize - 3, top: 2 }} />}
            </View>
            {on && <View style={{ position: 'absolute', left: 0, right: 0, bottom: line ? -1 : 4, height: 2, borderRadius: line ? 0 : 2, backgroundColor: colors.inverseStrong }} />}
          </Pressable>
        );
      })}
    </View>
  );
}
