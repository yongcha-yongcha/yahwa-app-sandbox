// 야화 UI 킷 — 리프 카드(시안 .cx-cost) · 잎 아이콘 (spec-dating §3.0-1)
// 리프가 드는 확인 시트(답장 · 다시 보기 · 특별편지로 바꾸기 · 2명 더 …) 안에 넣는다.
// 회색 카드 · 모서리 16 · 안쪽 16 · 아래 20: 흰 원 40(잎 22 강조 파랑) → 12 → "사용할 리프" 12/16.8 / "N리프" 20/26 600 → 오른쪽 "보유" 12/18 500 / "N리프" 14/18.2 600.
// free면 원가에 취소선 + 0리프. event면 '사용할 리프' 옆에 '연말까지 오픈 특별가' 표(리프 정책 v2). iOS 통화 숨김이면 부르는 쪽에서 그리지 않는다.
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../tokens';
import { LEAF_EVENT_LABEL } from '../lib/leafPricing';

// 잎(리프) — 피그마 Line/Nature/leaf(채움 · 마이페이지 리프와 같은 모양). 앱의 리프 아이콘은 모두 이것 하나(11-22 시안 type-icons ③).
// 잎이 24칸 안에 작게(약 17) 그려져 있어 보는 칸을 19로 좁혀 예전 선 리프와 비슷한 크기로 보이게 한다(자리 크기는 size 그대로)
const LEAF_D = 'M6.64824 7.33141C8.99667 4.84903 13.1707 3.60046 18.5643 3.99157L19.0906 4.03454L19.1795 4.04626C19.6175 4.12593 19.9549 4.48919 19.9959 4.93981C20.5095 10.5847 19.2527 14.9438 16.6863 17.3636C14.2668 19.6447 10.9243 19.9891 7.48124 18.3988C7.2012 19.1121 7.04859 19.7313 6.98906 20.1361C6.90847 20.6822 6.40054 21.0602 5.85429 20.9799C5.30804 20.8995 4.93045 20.3913 5.01054 19.8451C5.11196 19.1555 5.37871 18.149 5.87675 17.056C3.99156 13.424 4.2487 9.86787 6.64824 7.33141ZM18.0662 5.96325C13.1749 5.67426 9.82957 6.87959 8.10136 8.70641C6.62609 10.2659 6.16361 12.4655 7.16386 15.0609C8.59155 13.1636 10.2542 11.5158 12.4754 10.1488C12.9457 9.85938 13.5619 10.0057 13.8514 10.4759C14.1408 10.9463 13.9945 11.5624 13.5242 11.8519C11.4136 13.1508 9.85503 14.7388 8.47343 16.6547C11.2705 17.8984 13.6523 17.4754 15.3143 15.9086C17.144 14.1832 18.3543 10.8472 18.0662 5.96325Z';
export function LeafIcon({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="2.9 3 19 19">
      <Path d={LEAF_D} fill={color} />
    </Svg>
  );
}

// 이벤트가 표(리프 정책 v2) — 높이 20 · 좌우 7 · 모서리 10 · 옅은 파랑 바탕 · 11/600 진한 파랑. 할인율은 쓰지 않는다.
export function EventBadge({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignSelf: 'flex-start', height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.accentSubtle, justifyContent: 'center' }, style]}>
      <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.accentStrong }}>{LEAF_EVENT_LABEL}</Text>
    </View>
  );
}

export function LeafCostCard({ cost, free, event, balance, label = '사용할 리프', style }: {
  cost: number; free?: boolean; event?: boolean; balance: number; label?: string; style?: StyleProp<ViewStyle>;
}) {
  const pay = free ? 0 : cost;
  return (
    <View style={[{ marginBottom: 20, padding: 16, borderRadius: radius.card, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <LeafIcon size={22} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>{label}</Text>
          {event && !free && <EventBadge style={{ backgroundColor: colors.surface }} />}
        </View>
        <Text accessibilityLabel={free && cost > 0 ? `원래 ${cost}리프, 무료` : `${pay}리프`} style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>
          {free && cost > 0 && <Text style={{ fontSize: 14, fontWeight: '400', color: colors.subtle, textDecorationLine: 'line-through' }}>{cost}{' '}</Text>}
          {pay}리프
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.mute }}>보유</Text>
        <Text style={{ fontSize: 14, lineHeight: 18.2, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{balance.toLocaleString()}리프</Text>
      </View>
    </View>
  );
}
