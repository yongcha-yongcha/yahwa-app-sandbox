// 야화 — 전역 알림 한 줄(토스트) (리뉴얼 1120 · spec-shell §2.13 · §3-7)
// 작은 사각, 글 길이만큼만: 최소 높이 36 · 위아래 8 좌우 14 · 모서리 10 · #39444D · 흰 500 12/20 · 최대 폭 = 화면 − 40.
// 위치: 지금 화면의 아래 고정 영역(주 버튼·하단 메뉴) 중 가장 높은 것보다 12 위(ui/toastAnchor), 없으면 화면 아래에서 12 위.
// 나타남 460ms(7 아래 · 0.9배에서) · 최소 2.8초 머묾(띄운 쪽이 더 일찍 지워도 채운다) · 사라짐 380ms. 새 알림이 오면 이전 것은 바로 빠진다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dur, ease, radius, type, z } from '../tokens';
import { usePreview, previewSelectors } from '../lib/previewStore';
import { useToastBottom } from '../ui/toastAnchor';
import { NATIVE, reduceMotion } from '../ui/motion';
import { clearToastAction, useToastAction } from '../ui/toastAction';

export function Toast() {
  const toast = usePreview(previewSelectors.toast);
  const insets = useSafeAreaInsets();
  const anchor = useToastBottom();
  const action = useToastAction();
  const [shown, setShown] = useState<string | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const since = useRef(0);
  useEffect(() => {
    if (toast) {
      since.current = Date.now();
      setShown(toast);
      v.stopAnimation();
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: dur.toastIn, easing: ease.toast, useNativeDriver: NATIVE }).start();
      return;
    }
    const wait = Math.max(0, dur.toastStay - (Date.now() - since.current));
    const t = setTimeout(() => {
      Animated.timing(v, { toValue: 2, duration: dur.toastOut, easing: ease.toast, useNativeDriver: NATIVE }).start(({ finished }) => { if (finished) setShown(null); });
    }, wait);
    return () => clearTimeout(t);
  }, [toast, v]);
  if (!shown) return null;
  const still = reduceMotion();
  // 행동 버튼(되돌리기)은 그 글이 떠 있는 동안에만 붙는다
  const act = action && action.message === shown ? action : null;
  return (
    <View pointerEvents={act ? 'box-none' : 'none'} style={{ position: 'absolute', left: 20, right: 20, bottom: (anchor || insets.bottom) + 12, zIndex: z.toast, alignItems: 'center' }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={{
          minHeight: 36, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.toast, backgroundColor: colors.night, justifyContent: 'center',
          flexDirection: 'row', alignItems: 'center', gap: 12,
          opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
          transform: still ? [] : [
            { translateY: v.interpolate({ inputRange: [0, 1, 2], outputRange: [7, 0, 4] }) },
            { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.9, 1, 1] }) },
          ],
        }}
      >
        <Text style={[type.toast, { textAlign: 'center' }, Platform.OS === 'web' ? ({ wordBreak: 'keep-all' } as object) : null]}>{shown}</Text>
        {act && (
          <Pressable
            onPress={() => { const run = act.onPress; clearToastAction(); run(); }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ height: 28, paddingHorizontal: 8, marginVertical: -4, marginRight: -6, borderRadius: 8, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 12, lineHeight: 12, fontWeight: '600', color: colors.inverse }}>{act.label}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
