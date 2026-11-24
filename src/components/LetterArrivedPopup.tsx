// 야화 — 새 편지 도착 소식 카드 (리뉴얼 1120 · spec-dating §5-b-10, 모양은 spec-rest §3.9 `.yh-notice`)
// 예전 가운데 팝업 대신 화면 위에서 내려오는 카드: 위 12 · 좌우 12 · 높이 64 · 모서리 18 · 흰 바탕 · 그림자.
// 아이콘 원 40(편지 = 민트) + 12 + [편지가 도착했어요 14/19.6 600 / ○○ · 편지함에서 읽어 보세요 12/18] + 오른쪽 위 "방금" 11, 아래 가운데 손잡이 32×4.
// 누르면 그 편지(onConfirm), 4초 뒤 또는 위로 24 넘게 밀면 320ms로 올라가며 닫힌다(onLater).
// 아직 확인 안 한 새 편지가 있을 때 1회 — 띄우는 조건 · 이동은 부모(app/index)가 정한다.
import React, { useEffect, useRef } from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, ease, z } from '../tokens';
import { NATIVE, reduceMotion } from '../ui';

const H = 64;
const STAY = 4000;

export function LetterArrivedPopup({ visible, from, onConfirm, onLater }: {
  visible: boolean; from?: string | null; onConfirm: () => void; onLater: () => void;
}) {
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;      // 0 숨김(위) → 1 보임
  const drag = useRef(new Animated.Value(0)).current;   // 위로 미는 중(px, 음수)
  const cb = useRef({ onConfirm, onLater });
  cb.current = { onConfirm, onLater };
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useRef(() => {
    if (closing.current) return;
    closing.current = true;
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(v, { toValue: 0, duration: reduceMotion() ? 160 : 320, easing: ease.drawer, useNativeDriver: NATIVE }).start(() => cb.current.onLater());
  }).current;

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    drag.setValue(0);
    Animated.timing(v, { toValue: 1, duration: reduceMotion() ? 160 : 320, easing: ease.drawer, useNativeDriver: NATIVE }).start();
    timer.current = setTimeout(close, STAY);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [visible, v, drag, close]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => drag.setValue(Math.min(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (g.dy < -24) { close(); return; }
      drag.setValue(0);
      // 거의 안 움직였으면 누른 것 — 그 편지로
      if (Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6 && !closing.current) {
        if (timer.current) clearTimeout(timer.current);
        cb.current.onConfirm();
      }
    },
    onPanResponderTerminate: () => drag.setValue(0),
  })).current;

  if (!visible) return null;
  const still = reduceMotion();
  const top = insets.top + 12;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: z.top, paddingHorizontal: 12, alignItems: 'center' }}>
      <Animated.View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`편지가 도착했어요. ${from ? `${from}, ` : ''}편지함에서 읽어 보세요`}
        accessibilityLiveRegion="polite"
        style={[
          {
            marginTop: top, width: '100%', maxWidth: 560 - 24, height: H, paddingHorizontal: 14, borderRadius: 18,
            backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12,
            boxShadow: '0px 0px 0px 1px rgba(57,68,77,0.06), 0px 10px 28px rgba(57,68,77,0.16)',
          },
          still
            ? { opacity: v }
            : { opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: Animated.add(v.interpolate({ inputRange: [0, 1], outputRange: [-(H + top), 0] }), drag) }] },
        ]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mintSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mintInk} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M3 6Q12 5 21 6V19H3Z M3 7L12 14L21 7 M3 19L9 13 M21 19L15 13" />
          </Svg>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text }}>편지가 도착했어요</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>{from ? `${from} · ` : ''}편지함에서 읽어 보세요</Text>
        </View>
        <Text style={{ alignSelf: 'flex-start', marginTop: 14, fontSize: 11, lineHeight: 15.4, color: colors.mute }}>방금</Text>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 5, alignItems: 'center' }}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.muted }} />
        </View>
      </Animated.View>
    </View>
  );
}
