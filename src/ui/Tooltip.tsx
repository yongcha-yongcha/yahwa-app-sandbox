// 야화 UI 킷 — 말풍선(온보딩 안내, spec-shell §2.14 · §3-8)
// 불투명 #273037 · 흰 500 13/1.45 한 줄 · 위아래 10 좌우 14 · 모서리 12 · 꼬리 20×9(대상 가운데를 가리킴).
// small(하단 메뉴 탭을 가리킬 때): 12/16 · 위아래 6 좌우 12 · 모서리 10 · 꼬리 14×6.
// 위치는 부르는 쪽이 잡는다: 대상 위 10(small 4)에 오도록 style로 놓고(position: 'absolute'), tailX = 말풍선 왼쪽에서 꼬리 가운데까지.
// 닫기 버튼 없이 저절로 사라지게 visible을 시간으로 끈다(4초·3초). 나타남 180ms · 사라짐 140ms.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, dur, ease, shadow } from '../tokens';
import { NATIVE, reduceMotion } from './motion';

export function Tooltip({ visible, text, tailX, small, left, style }: {
  visible: boolean; text: string; tailX?: number; small?: boolean; left?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(v, { toValue: visible ? 1 : 0, duration: visible ? dur.tipIn : dur.tipOut, easing: visible ? ease.out : Easing.in(Easing.ease), useNativeDriver: NATIVE })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible, v]);
  if (!mounted) return null;
  const tw = small ? 14 : 20, th = small ? 6 : 9;
  const tx = Math.max(8, Math.min((tailX ?? w / 2) - tw / 2, Math.max(8, w - tw - 8)));
  const still = reduceMotion();
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        { alignSelf: 'flex-start', paddingBottom: th - 1, opacity: v, transform: still ? [] : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
        style,
      ]}
    >
      <View style={[{ backgroundColor: colors.inverseStrong, borderRadius: small ? 10 : 12, paddingVertical: small ? 6 : 10, paddingHorizontal: small ? 12 : 14, flexDirection: 'row', alignItems: 'center', gap: 6 }, shadow.tooltip]}>
        {left}
        <Text numberOfLines={1} style={{ fontSize: small ? 12 : 13, lineHeight: small ? 16 : 18.85, fontWeight: '500', color: '#FFFFFF' }}>{text}</Text>
      </View>
      {/* 꼬리 — 몸통 아랫변에서 곡선으로 이어지고 끝이 둥글다(몸통과 1 겹침) */}
      <Svg width={tw} height={th} viewBox="0 0 20 9" style={{ position: 'absolute', left: tx, bottom: 0 }}>
        <Path d="M0 0H20C16 0 13.5 3 11.6 7.2C10.9 8.6 9.1 8.6 8.4 7.2C6.5 3 4 0 0 0Z" fill={colors.inverseStrong} />
      </Svg>
    </Animated.View>
  );
}
