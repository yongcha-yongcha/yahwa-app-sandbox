// 야화 — MY 안쪽 화면 공용 틀과 작은 부품(리뉴얼 1120 · spec-rest §2)
import React, { useRef } from 'react';
import { Animated, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, layout, z } from '../../tokens';
import { KeyboardAware } from '../KeyboardAware';
import { LeafIcon, NATIVE, TopBar, useTabBarClearance } from '../../ui';

// 안쪽 화면 틀 — 머리 줄(위 4 · 높이 44 · 11-22 24 → 4) + 아래 16부터 본문(첫 내용 y=64). 2px 넘게 스크롤하면 머리 아래에 옅은 띠(200ms).
//  gnb: 하단 메뉴가 떠 있는 화면이면 아래를 메뉴 높이만큼 비운다(MY_GNB에 넣은 화면). dock: 아래 고정 버튼 영역(<DockArea>) — 있으면 gnb는 끈다.
//  scroll=false: 본문을 직접 배치(지도처럼 스스로 스크롤을 쥐는 화면).
export function Screen({ title, onBack, rightText, onRightPress, right, children, gnb = true, dock, scroll = true, top = 16, padX = layout.gutter, contentStyle, scrollRef, onScrollY, scrollEnabled }: {
  title?: string; onBack?: () => void; rightText?: string; onRightPress?: () => void; right?: React.ReactNode;
  children: React.ReactNode; gnb?: boolean; dock?: React.ReactNode; scroll?: boolean; top?: number; padX?: number;
  contentStyle?: StyleProp<ViewStyle>; scrollRef?: React.Ref<ScrollView>; onScrollY?: (y: number) => void; scrollEnabled?: boolean;
}) {
  const clearance = useTabBarClearance();
  const band = useRef(new Animated.Value(0)).current;
  const scrolled = useRef(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    onScrollY?.(y);
    const on = y > 2;
    if (on === scrolled.current) return;
    scrolled.current = on;
    Animated.timing(band, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: NATIVE }).start();
  };
  const bottom = dock ? 24 : gnb ? clearance : 40;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ zIndex: z.sticky, backgroundColor: colors.bg }}>
        <TopBar title={title} onBack={onBack} rightText={rightText} onRightPress={onRightPress} right={right} />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '100%', height: 24, opacity: band }}>
          <LinearGradient colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      <KeyboardAware style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            scrollEnabled={scrollEnabled}
            style={{ flex: 1 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[{ flexGrow: 1, paddingTop: top, paddingHorizontal: padX, paddingBottom: bottom }, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingTop: top, paddingHorizontal: padX }, contentStyle]}>{children}</View>
        )}
        {dock}
      </KeyboardAware>
    </View>
  );
}

// 묶음 제목(.ip-sh · .rw-sh · .cf-l) — 13/20 600 글자-연
export function GroupTitle({ children, top = 24, bottom = 8, right }: { children: React.ReactNode; top?: number; bottom?: number; right?: React.ReactNode }) {
  return (
    <View style={{ marginTop: top, marginBottom: bottom, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.mute }}>{children}</Text>
      {right}
    </View>
  );
}

// 안내 한 줄(.ip-sub) — 13/20 글자-연
export function Sub({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[{ fontSize: 13, lineHeight: 20, color: colors.mute }, style as any]}>{children}</Text>;
}

// 사실 줄(.ip-facts) — 아이콘 20 + 12 + 글 14/20 글자-보조. 줄 사이 14는 부모 gap으로
export function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {icon}
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{children}</Text>
    </View>
  );
}

// 표 한 줄(충전 확인 · 포인트 바꾸기) — 15/22, 이름 글자-보조 400 · 값 글자-진 500. strong: 합계 줄(600)
export function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: strong ? '600' : '400', color: strong ? colors.text : colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: strong ? '600' : '500', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

// 내역 한 줄(.fx-row 내역) — 제목 15/24 + 날짜 13/22.75 글자-안내 | 금액 14/22.4 700. 묶음 카드 안에서 쓴다(첫 줄은 first)
export function LedgerRow({ title, at, amount, first }: { title: string; at: string; amount: string; first?: boolean }) {
  return (
    <View style={{ marginHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {/* 줄 사이 선 — 높이에 더하지 않고 윗줄 마지막 1px에 겹친다(시안 .fx-row box-shadow 0 -1px) */}
      {!first && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 1, backgroundColor: colors.line }} />}
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontSize: 15, lineHeight: 24, color: colors.text }}>{title}</Text>
        {!!at && <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 22.75, color: colors.sub }}>{at}</Text>}
      </View>
      <Text style={{ fontSize: 14, lineHeight: 22.4, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{amount}</Text>
    </View>
  );
}

// 빈 상태 한 줄(.nb-empty) — 14/21 글자-보조
export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>{children}</Text>;
}

// 지갑 잎 — 앱 공용 리프(LeafIcon · 피그마 Line/Nature/leaf)와 같은 모양. 보유 리프 20(강조 파랑) · 묶음 16(회색) · 보너스 14(강조 파랑)
export function WalletLeaf({ size = 16, color = colors.mute }: { size?: number; color?: string }) {
  return <LeafIcon size={size} color={color} />;
}

// 한국 시각 'YYYY. M. D.' / 'YYYY. M. D. 오후 9:32' — 기기 시간대와 무관하게(+9h, UTC 필드)
export function kstDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const d = new Date(t + 9 * 3600_000);
  const day = `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
  if (!withTime) return day;
  const h = d.getUTCHours();
  return `${day} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
