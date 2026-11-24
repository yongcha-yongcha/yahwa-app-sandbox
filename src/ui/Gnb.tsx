// 야화 UI 킷 — 하단 메뉴(GNB, spec-shell §2.17 · §3-4, gnb=gray)
// 떠 있는 알약 하나: 좌우 20 · 바닥 max(20, 안전 영역) · 높이 64 · 모서리 32 · 미색 60% + 뒤 흐림 6 · 1px 흰 20% 테두리 · 그림자.
// 다섯 칸(인연 홈 · 마음함 · 편지함 · 커뮤니티 · MY 사진) 같은 폭 · 칸 높이 54. 고른 칸에 회색 캡슐(모서리 27)이 260ms로 미끄러져 온다.
// 아이콘 24 · 선 1.5 #39444D → 고른 탭은 같은 모양을 #273037로 채운 아이콘으로 140ms 페이드. 라벨 글자는 없다(읽기 도구용 이름만).
// 알림 점 8(빨강 + 흰 링 1) — 칸 가로 가운데에서 오른쪽 8, 위에서 11. 누름: 칸 0.94배(100ms).
// 흐림: iOS는 BlurView, 웹은 CSS backdrop-filter, 안드로이드는 흐림 없이 불투명에 가까운 미색(목록 위에서 프레임을 지키려고).
// 화면 쪽: 탭 화면 스크롤 영역 아래 여백은 useTabBarClearance() — 64 + 바닥 + 12.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dur, ease, layout, radius, shadow, z } from '../tokens';
import { thumbUrl } from '../lib/img';
import { useKeyboardHeight } from '../components/KeyboardAware';
import { NATIVE, reduceMotion, usePress } from './motion';
import { useToastAnchor } from './toastAnchor';

export type GnbTab = 'affinity' | 'heart' | 'letters' | 'lounge' | 'me';
export const GNB_TABS: { k: GnbTab; label: string }[] = [
  { k: 'affinity', label: '인연 홈' },
  { k: 'heart', label: '마음함' },
  { k: 'letters', label: '편지함' },
  { k: 'lounge', label: '커뮤니티' },
  { k: 'me', label: '마이페이지' },
];
const CELL_H = 54;
const INSET = 4;

// 하단 메뉴 바닥 위치 · 화면이 비워 둘 높이
export function useGnbBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(layout.gnbBottom, insets.bottom);
}
export function useTabBarClearance(extra: number = layout.gnbGap): number {
  return layout.gnbH + useGnbBottom() + extra;
}

const LINE = { fill: 'none', stroke: colors.gnbIcon, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
function NavIcon({ k, filled }: { k: GnbTab; filled: boolean }) {
  const knock = { fill: 'none', stroke: colors.gnbKnock, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const c = colors.gnbIconActive;
  if (k === 'affinity') {
    return filled ? (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill={c}>
        <Rect x={2.25} y={2.25} width={8.5} height={9.5} rx={2.5} /><Rect x={13.25} y={2.25} width={8.5} height={9.5} rx={2.5} />
        <Rect x={2.25} y={14.25} width={8.5} height={7.5} rx={2.5} /><Rect x={13.25} y={14.25} width={8.5} height={7.5} rx={2.5} />
      </Svg>
    ) : (
      <Svg width={24} height={24} viewBox="0 0 24 24" {...LINE} strokeWidth={1.5}>
        <Rect x={3} y={3} width={7} height={8} rx={2} /><Rect x={14} y={3} width={7} height={8} rx={2} />
        <Rect x={3} y={15} width={7} height={6} rx={2} /><Rect x={14} y={15} width={7} height={6} rx={2} />
      </Svg>
    );
  }
  if (k === 'heart') {
    // viewBox 32 — 화면에서 선 1.5가 되게 2로 그린다
    return filled
      ? <Svg width={24} height={24} viewBox="0 0 32 32" fill={c}><Path d="M16 27C12 24 3.6 18 4 11.2C4.4 4.5 12.1 4.3 15.6 10.2C18.3 3.9 26.8 3.8 28 10.6C29.1 16.5 22 24 16 27Z" /></Svg>
      : <Svg width={24} height={24} viewBox="0 0 32 32" {...LINE} strokeWidth={2}><Path d="M16 26C12 23 4.5 17.5 5 11.3C5.4 5.5 12.2 5.5 15.6 12.2C18.1 5.2 25.8 4.9 27 10.8C28.1 16.1 21.6 23.1 16 26Z" /></Svg>;
  }
  if (k === 'letters') {
    return filled ? (
      <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M2.25 5.4Q12 4.2 21.75 5.4V19.75H2.25Z" fill={c} /><Path d="M3 7L12 14L21 7 M3 19L9 13 M21 19L15 13" {...knock} /></Svg>
    ) : (
      <Svg width={24} height={24} viewBox="0 0 24 24" {...LINE} strokeWidth={1.5}><Path d="M3 6Q12 5 21 6V19H3Z M3 7L12 14L21 7 M3 19L9 13 M21 19L15 13" /></Svg>
    );
  }
  if (k === 'lounge') {
    return filled ? (
      <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M3.25 4.25h17.5v13.5H9.3l-6.05 4.8Z" fill={c} /><Path d="M8 9h8M8 13h5" {...knock} /></Svg>
    ) : (
      <Svg width={24} height={24} viewBox="0 0 24 24" {...LINE} strokeWidth={1.5}><Path d="M4 5h16v12H9l-5 4V5M8 9h8M8 13h5" /></Svg>
    );
  }
  // MY — 사진이 없을 때(게스트)만 쓰는 사람 아이콘(시안에는 없다: 같은 선 굵기로 그림)
  return filled ? (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill={c}><Circle cx={12} cy={8} r={4.5} /><Path d="M3.5 21c0-4.4 3.8-7.3 8.5-7.3s8.5 2.9 8.5 7.3Z" /></Svg>
  ) : (
    <Svg width={24} height={24} viewBox="0 0 24 24" {...LINE} strokeWidth={1.5}><Circle cx={12} cy={8} r={3.75} /><Path d="M4.25 20.25c0-3.7 3.4-6 7.75-6s7.75 2.3 7.75 6Z" /></Svg>
  );
}

function Cell({ k, label, active, dot, avatar, onPress }: { k: GnbTab; label: string; active: boolean; dot?: boolean; avatar?: string | number; onPress: () => void }) {
  const press = usePress(0.94, 100, 100);
  const sel = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) { sel.setValue(active ? 1 : 0); return; }
    Animated.timing(sel, { toValue: active ? 1 : 0, duration: dur.navIcon, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [active, sel]);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={dot ? `${label}, 새 소식 있음` : label}
      style={{ flex: 1, height: CELL_H }}
    >
      <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, press.scaleStyle]}>
        {k === 'me' && avatar ? (
          // 내 사진 — 지름 32(사진 28 + 안쪽 2) · 테두리 흰 1.5 / 고르면 #505C65 2
          <View style={{ width: 32 + (active ? 4 : 3), height: 32 + (active ? 4 : 3), borderRadius: 18, borderWidth: active ? 2 : 1.5, borderColor: active ? colors.gnbAvatarRing : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Image source={typeof avatar === 'string' ? { uri: thumbUrl(avatar, 96) ?? avatar } : avatar} style={{ width: 28, height: 28, borderRadius: 14 }} contentFit="cover" />
          </View>
        ) : (
          <View style={{ width: 24, height: 24 }}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: sel.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}><NavIcon k={k} filled={false} /></Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: sel }]}><NavIcon k={k} filled /></Animated.View>
          </View>
        )}
        {dot && <View pointerEvents="none" style={{ position: 'absolute', left: '50%', marginLeft: 8 - 1, top: 11 - 1, width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: colors.badge }} />}
      </Animated.View>
    </Pressable>
  );
}

export function Gnb({ active, onTab, dots, avatar, visible = true }: {
  active: GnbTab | null;                       // null이면 어느 칸도 켜지지 않는다(쿠폰함 계열 화면)
  onTab?: (k: GnbTab) => void;
  dots?: Partial<Record<GnbTab, boolean>>;     // 알림 점(숫자는 보여 주지 않는다)
  avatar?: string | number;                    // 내 프로필 사진(없으면 사람 아이콘)
  visible?: boolean;                           // 하단 메뉴가 없는 화면에서는 160ms로 숨는다
}) {
  const bottom = useGnbBottom();
  const kbUp = useKeyboardHeight() > 0;
  const show = visible && !kbUp;
  const [cellW, setCellW] = useState(0);
  const idx = active ? GNB_TABS.findIndex((t) => t.k === active) : -1;
  const x = useRef(new Animated.Value(0)).current;
  const capOn = useRef(new Animated.Value(idx >= 0 ? 1 : 0)).current;
  const layer = useRef(new Animated.Value(show ? 1 : 0)).current;
  const placed = useRef(false);
  useToastAnchor(show ? layout.gnbH + bottom : null);

  // 캡슐 — 이전 칸 → 새 칸 260ms Drawer(처음 자리 잡을 때·동작 줄이기면 바로)
  useEffect(() => {
    if (!cellW) return;
    capOn.setValue(idx >= 0 ? 1 : 0);
    if (idx < 0) return;
    if (!placed.current || reduceMotion()) { placed.current = true; x.setValue(idx * cellW); return; }
    Animated.timing(x, { toValue: idx * cellW, duration: dur.capsule, easing: ease.drawer, useNativeDriver: NATIVE }).start();
  }, [idx, cellW, x, capOn]);
  useEffect(() => {
    Animated.timing(layer, { toValue: show ? 1 : 0, duration: reduceMotion() ? 0 : dur.navLayer, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [show, layer]);

  return (
    <Animated.View
      pointerEvents={show ? 'box-none' : 'none'}
      accessibilityElementsHidden={!show}
      importantForAccessibility={show ? 'auto' : 'no-hide-descendants'}
      style={{ position: 'absolute', left: layout.gutter, right: layout.gutter, bottom, height: layout.gnbH, zIndex: z.gnb, opacity: layer }}
    >
      <View style={[{ flex: 1, borderRadius: radius.gnb }, shadow.gnb]}>
        <View style={[{ flex: 1, borderRadius: radius.gnb, overflow: 'hidden', backgroundColor: Platform.OS === 'android' ? colors.gnbBgSolid : colors.gnbBg }, Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px) saturate(170%)', WebkitBackdropFilter: 'blur(6px) saturate(170%)' } as object) : null]}>
          {Platform.OS === 'ios' && <BlurView intensity={12} tint="light" style={StyleSheet.absoluteFill} />}
          <View accessibilityRole="tablist" onLayout={(e) => setCellW(e.nativeEvent.layout.width / GNB_TABS.length)} style={{ flex: 1, marginHorizontal: INSET, flexDirection: 'row', alignItems: 'center' }}>
            {cellW > 0 && (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: (layout.gnbH - CELL_H) / 2, width: cellW, height: CELL_H, borderRadius: radius.gnbCapsule, backgroundColor: colors.gnbCapsule, opacity: capOn, transform: [{ translateX: x }] }} />
            )}
            {GNB_TABS.map((t) => (
              <Cell key={t.k} k={t.k} label={t.label} active={active === t.k} dot={dots?.[t.k]} avatar={avatar} onPress={() => onTab?.(t.k)} />
            ))}
          </View>
          {/* 1px 흰 20% 테두리 — 칸 폭에 영향을 주지 않게 덧씌운다 */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius.gnb, borderWidth: 1, borderColor: colors.gnbBorder }]} />
        </View>
      </View>
    </Animated.View>
  );
}
