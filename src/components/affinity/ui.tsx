// 야화 — 인연 화면 공용 조각 (시안 사이트 '시스템 적용' 실측, 1013-B)
// · ProfileScroll: .profile-scroll — 옅은 보라 그라데이션이 내용과 함께 스크롤된다(background-attachment: local)
// · SendButton: .send-button — 옅은 파랑 바탕 + 파랑 글자 17/600, 높이 56, 모서리 12
// · AffinityModal / ModalText: .review-modal — 옅은 딤 위 가운데 카드, 제목 22/600, 본문 14 회색, 맨 아래 '닫기'
import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Platform, Animated, Easing, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, getThemeMode } from '../../tokens';
import { pressFx as sharedPressFx } from '../../lib/press';
import { Tap } from '../Tap';

// 시안 본문 기본 자간(-0.24px) — 따로 정하지 않은 글자는 모두 이 값을 물려받는다
export const LS = -0.24;

// 웹은 색의 투명도를 소수 둘째 자리로 반올림한다(0.816 → 0.82). 시안 값을 그대로 쓰려고 웹에서만 CSS 변수 대체값으로 넘긴다.
export const exactColor = (c: string) => (Platform.OS === 'web' ? `var(--yh-exact, ${c})` : c);

// 시안 제목(h1·h2·h3)은 낱말 단위로만, 줄 길이를 고르게 바꾼다(word-break: keep-all · text-wrap: pretty). 앱(iOS)은 lineBreakStrategyIOS="hangul-word"를 함께 준다.
export const keepAll = (Platform.OS === 'web' ? { wordBreak: 'keep-all', textWrap: 'pretty', whiteSpace: 'pre-line' } : {}) as any;

// 웹 글자 줄바꿈 — 줄 끝 공백을 접는다(RN 웹 기본 pre-wrap은 줄 끝 공백까지 폭에 넣는다)
export const webWrap = (Platform.OS === 'web' ? { whiteSpace: 'pre-line' } : {}) as any;

// 시안 눌림(.review button:active) — 공용 값(lib/press, 1022: 투명도 0.8 · 0.985배 · 0.22초 되돌림)
export const pressFx = (pressed: boolean) => sharedPressFx(pressed);

// 시안 --ds-profile-text(#64666c) — 프로필 값·본문 글자. 다크는 보조 글자색
export const profileInk = () => (getThemeMode() === 'dark' ? colors.sub : '#64666c');

// 시안 1017 .profile-scroll: #fff 0 · #fcfbfd 8% · #f7f4f9 32% · #fbf6f7 65~100%
const GRADIENT = ['#ffffff', '#fcfbfd', '#f7f4f9', '#fbf6f7', '#fbf6f7'] as const;
const STOPS = [0, 0.08, 0.32, 0.65, 1] as const;

// 다크 모드는 그라데이션 대신 바탕색(colors.surface)
export function ProfileBackdrop() {
  if (getThemeMode() === 'dark') return null;
  return <LinearGradient pointerEvents="none" colors={GRADIENT} locations={STOPS} style={StyleSheet.absoluteFillObject} />;
}

export const ProfileScroll = React.forwardRef<ScrollView, ScrollViewProps & {
  padTop: number; padBottom: number; children: React.ReactNode;
  plain?: boolean;   // 1020 시안 white-dating — 그라데이션 없이 흰 바탕(오늘의 인연·호감 목록)
}>(function ProfileScroll({ padTop, padBottom, children, contentContainerStyle, plain, ...rest }, ref) {
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, backgroundColor: plain ? colors.surface : undefined }}
      showsVerticalScrollIndicator={false}
      {...rest}
      contentContainerStyle={[{ flexGrow: 1, paddingTop: padTop, paddingBottom: padBottom, paddingHorizontal: 24 }, contentContainerStyle]}
    >
      {/* 흰 바탕일 때도 빈 칸을 둔다 — 첫 자식 자리를 지켜 stickyHeaderIndices가 그대로 맞게 */}
      {plain ? <View pointerEvents="none" /> : <ProfileBackdrop />}
      {children}
    </ScrollView>
  );
});

const sendBg = () => (getThemeMode() === 'dark' ? colors.bgSoft : '#f1f2f3');
const sendOffBg = () => (getThemeMode() === 'dark' ? colors.bgSoft : '#f5f5f7');
export const sendInk = () => (getThemeMode() === 'dark' ? colors.text : '#42474d');

// 1017 시안 .send-button: 파란 채운 버튼(높이 52 · 위아래 12 · 모서리 12) + 흰 글자 17/650. 비활성은 옅은 회색 바탕 + 회색 글자
export function SendButton({ label, onPress, disabled, style, children }: {
  label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode; big?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          // 1027(pr9) 시안 send-button: 높이 52 · 위아래 14 · 좌우 18 · 모서리 16 · 옅은 회색(#f1f2f3) + 16/23.2 700 #42474d
          // 비활성: #f5f5f7 + #abb0b6
          height: 52, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, flexDirection: 'row', gap: 8,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: disabled ? sendOffBg() : sendBg(),
          ...pressFx(pressed),
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 16, lineHeight: 23.2, fontWeight: '700', letterSpacing: LS, color: disabled ? colors.disabled : sendInk() }}>{label}</Text>
      {children}
    </Tap>
  );
}

// 1017 시안 .review-modal: 가운데 카드(안쪽 24 · 모서리 20), 제목 22/650, 맨 아래 [닫기]는 옅은 회색 알약(13/600, 위 8)
// 모달 들어오는 효과(시안 1020) — 딤은 0.24초 서서히, 카드는 0.3초 동안 20px 아래에서 떠오르며 나타난다
// (cubic-bezier(.22,.68,0,1)). 시스템 '동작 줄이기'면 바로 보인다.
export function useSheetIn(open: boolean) {
  const shade = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) { shade.setValue(0); card.setValue(0); return; }
    const nd = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(shade, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: nd }),
      Animated.timing(card, { toValue: 1, duration: 300, easing: Easing.bezier(0.22, 0.68, 0, 1), useNativeDriver: nd }),
    ]).start();
  }, [open, shade, card]);
  return {
    shade: { opacity: shade },
    card: { opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
  };
}

export function AffinityModal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  const anim = useSheetIn(open);
  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose}>
      {/* 1027(pr9) 시안 modal-shade: 안쪽 16 · rgba(35,33,43,.36) */}
      <View style={{ flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: getThemeMode() === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(35,33,43,0.36)' }, anim.shade]} />
        <Tap style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="닫기" />
        {/* 1027(pr9) 시안 review-modal: 모서리 24 · 테두리 1 #edecef · 그림자 0 18 60 12% */}
        <Animated.View accessibilityViewIsModal style={[{ width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: getThemeMode() === 'dark' ? colors.line : '#edecef', shadowColor: '#241e30', shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 8 }, anim.card]}>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }} bounces={false} showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={{ fontSize: 22, lineHeight: 30.8, fontWeight: '700', letterSpacing: -0.6, color: colors.text, marginBottom: 16, ...keepAll }}>{title}</Text>
            {children}
            <Tap
              onPress={onClose}
              accessibilityRole="button"
              // 1027(pr9) 시안 modal-close: 바탕 없음 · 높이 44(안쪽 12) · 모서리 16 · 13/18.2 650 회색, 위 8
              style={({ pressed }) => ({ marginTop: 8, minHeight: 44, padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...pressFx(pressed) })}
            >
              <Text style={{ fontSize: 13, lineHeight: 18.2, fontWeight: '650' as any, letterSpacing: LS, color: colors.sub }}>닫기</Text>
            </Tap>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// 모달 본문 단락(16/500 · 줄 27.2, 프로필 글자색) — 앞 아이콘은 글자와 같은 줄에 놓이고, 줄이 넘치면 왼쪽 끝부터 이어진다(시안과 같음)
// 시안 단락 위아래 16은 앞뒤 여백과 겹친다 — 맨 끝 단락(바로 [닫기])은 last로 8만 둔다([닫기] 위 8과 합쳐 16)
export function ModalText({ icon, children, style, last }: { icon?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle>; last?: boolean }) {
  return (
    <View style={[{ marginTop: 0, marginBottom: last ? 16 : 24 }, style]}>
      <Text style={{ fontSize: 16, lineHeight: 28, fontWeight: '500', letterSpacing: LS, color: profileInk(), ...webWrap }}>
        {icon ? <View style={{ width: 23, height: 15, transform: [{ translateY: 3.78 }] }}>{icon}</View> : null}
        {children}
      </Text>
    </View>
  );
}

// 빈 상태 문구(.empty)
export function EmptyText({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginVertical: 30 }, style]}>
      <Text style={{ fontSize: 13, lineHeight: 24.7, letterSpacing: LS, color: colors.sub }}>{children}</Text>
    </View>
  );
}
