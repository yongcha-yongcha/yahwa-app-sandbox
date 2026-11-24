// 야화 UI 킷 — 머리 줄 · 뒤로 · 진행 막대 · 탭 화면 제목(spec-shell §2.15)
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, dur, ease, layout, type as typo } from '../tokens';
import { Icon } from './icons';
import { NATIVE, reduceMotion, usePress } from './motion';

// 뒤로 버튼 — 터치 44×44(왼쪽 끝이 여백선 20). 꺾쇠 24를 터치 영역 가운데에서 왼쪽으로 8 옮겨 그린다
export function BackButton({ onPress, label = '뒤로', color = colors.text }: { onPress?: () => void; label?: string; color?: string }) {
  const press = usePress(0.94);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ marginLeft: -16 }, press.scaleStyle]}><Icon name="chevron-left-large" size={24} color={color} /></Animated.View>
    </Pressable>
  );
}

// 머리 줄 — 위 24(SafeArea 아래부터) · 높이 44 · 좌우 20. 왼쪽 뒤로, 가운데 제목(고딕 600 16, 양옆 88 비움, 길면 말줄임), 오른쪽 요소.
// 가입 흐름은 title 없이 쓴다(가운데 로고·제목 없음). rightText: 글자 버튼(600 14 강조 파랑).
// 본문은 이 줄 아래 16부터(첫 내용 y=84).
export function TopBar({ title, onBack, right, rightText, onRightPress, top = layout.topPad, style }: {
  title?: string; onBack?: () => void; right?: React.ReactNode; rightText?: string; onRightPress?: () => void; top?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginTop: top, height: layout.headerH, paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      {onBack ? <BackButton onPress={onBack} /> : <View style={{ width: 44 }} />}
      {!!title && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 88, right: 88, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text numberOfLines={1} accessibilityRole="header" style={typo.pageTitle}>{title}</Text>
        </View>
      )}
      {right ?? (rightText ? (
        <Pressable onPress={onRightPress} accessibilityRole="button" hitSlop={8} style={{ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.accent }}>{rightText}</Text>
        </Pressable>
      ) : <View style={{ width: 44 }} />)}
    </View>
  );
}

// 진행 막대 — 머리 아래 16 · 높이 3 · 좌우 20 · 바탕 #E3E7EA · 채움 #39444D. rounded: 소개 4단계(모서리 3), 가입 3단계는 0.
// 폭은 네이티브 드라이버로 못 움직여서 가득 찬 채움을 translateX로 밀어 넣는다. 같은 장 360ms · chapter(새 장, 빈 막대에서 새로 채움) 520ms.
export function ProgressBar({ value, rounded, chapter, style }: { value: number; rounded?: boolean; chapter?: unknown; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(value)).current;
  const w = useRef(new Animated.Value(0)).current;
  const lastChapter = useRef(chapter);
  useEffect(() => {
    const fresh = lastChapter.current !== chapter;
    lastChapter.current = chapter;
    if (reduceMotion()) { v.setValue(value); return; }
    if (fresh) v.setValue(0);
    Animated.timing(v, { toValue: value, duration: fresh ? dur.progressChapter : dur.progress, delay: fresh ? 280 : 0, easing: ease.drawer, useNativeDriver: NATIVE }).start();
  }, [value, chapter, v]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={(e) => w.setValue(e.nativeEvent.layout.width)}
      style={[{ marginTop: 16, marginHorizontal: layout.gutter, height: 3, borderRadius: rounded ? 3 : 0, backgroundColor: colors.line, overflow: 'hidden' }, style]}
    >
      <Animated.View style={{ flex: 1, borderRadius: rounded ? 3 : 0, backgroundColor: colors.text, transform: [{ translateX: Animated.multiply(Animated.subtract(v, 1), w) }] }} />
    </View>
  );
}

// 탭 화면 제목 — 머리 줄 없이 큰 제목 명조 26/40(왼쪽 20, 위 12 · 11-22 30 → 12) + 부제목 12/19.2 #818C94(제목 아래 10 · 아래 24). right: 오른쪽 위 아이콘 버튼들
export function TabTitle({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingTop: 12, paddingHorizontal: layout.gutter, paddingBottom: subtitle ? 24 : 0 }, style]}>
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={typo.tabTitle}>{title}</Text>
        {right}
      </View>
      {!!subtitle && <Text style={[typo.subtitle, { marginTop: 10 }]}>{subtitle}</Text>}
    </View>
  );
}
