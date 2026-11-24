// 야화 — 공감(하트) · 이야기 수(말풍선) 버튼(리뉴얼 1120, 시안 .cx-act · spec-rest §3.1 · §3.3)
// 큰 것(목록 · 글): 높이 40 · 최소 폭 44 · 좌우 10 · 아이콘 20 + 5 + 숫자 13/16 500. 작은 것(댓글): 높이 32 · 아이콘 16 · 숫자 12/16.
// 색은 글자-보조, 0이면 숫자만 글자-연(0도 보여 준다). 공감한 하트는 채운 하트 + 숫자 장미색.
// 공감 모션(§3.3) — 켤 때: 하트 1 → 0.8(25%) → 1.25(60%) → 1, 420ms + 지름 6 장미 점 6개가 60° 간격으로 퍼짐(80ms 뒤, 460ms,
//   반지름 0 → 14(60%, 크기 0.9) → 19(크기 0.2 · 투명)) + 숫자는 아래 14에서 올라옴(240ms, 줄어들 땐 위에서). 끌 때: 0.9 → 1, 160ms.
//   움직임 줄이기면 색 · 숫자만 바뀐다. 전부 transform · opacity(네이티브 드라이버).
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { colors, ease } from '../../tokens';
import { haptic, NATIVE, reduceMotion } from '../../ui';
import { CIcon } from './cIcons';

const DOTS = [0, 60, 120, 180, 240, 300];

export const LikeButton = React.memo(function LikeButton({ liked, count, small, onPress, label, disabled }: {
  liked: boolean; count: number; small?: boolean; onPress?: () => void; label?: string; disabled?: boolean;
}) {
  const pop = useRef(new Animated.Value(1)).current;     // 하트 크기 진행(0 → 1)
  const burst = useRef(new Animated.Value(0)).current;   // 점 퍼짐(0 → 1)
  const roll = useRef(new Animated.Value(0)).current;    // 숫자 굴림(1 → 0)
  const prev = useRef({ liked, count });
  // 숫자가 굴러 들어오는 방향 — 그리는 순간에 정한다(늘면 아래에서, 줄면 위에서)
  const dir = useRef(1);
  const seen = useRef(count);
  if (seen.current !== count) { dir.current = count > seen.current ? 1 : -1; seen.current = count; }

  useEffect(() => {
    const was = prev.current;
    prev.current = { liked, count };
    if (reduceMotion()) return;
    if (was.liked !== liked) {
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: liked ? 420 : 160, easing: ease.out, useNativeDriver: NATIVE }).start();
      if (liked) {
        burst.setValue(0);
        Animated.timing(burst, { toValue: 1, duration: 460, delay: 80, easing: ease.out, useNativeDriver: NATIVE }).start();
      }
    }
    if (was.count !== count) {
      roll.setValue(1);
      Animated.timing(roll, { toValue: 0, duration: 240, easing: ease.out, useNativeDriver: NATIVE }).start();
    }
  }, [liked, count, pop, burst, roll]);

  const icon = small ? 16 : 20;
  const fg = liked ? colors.love : colors.textSecondary;
  const scale = liked
    ? pop.interpolate({ inputRange: [0, 0.25, 0.6, 1], outputRange: [1, 0.8, 1.25, 1] })
    : pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return (
    <Pressable
      onPress={() => { haptic('selection'); onPress?.(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? `공감 ${count}`}
      accessibilityState={{ selected: liked }}
      style={{ minWidth: 44, height: small ? 32 : 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <View style={{ width: icon, height: icon }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <CIcon name={liked ? 'heart-fill' : 'heart'} size={icon} color={fg} />
        </Animated.View>
        {/* 퍼지는 점 6개 — 하트 가운데에서 */}
        {DOTS.map((deg) => (
          <Animated.View
            key={deg}
            pointerEvents="none"
            style={{
              position: 'absolute', left: icon / 2 - 3, top: icon / 2 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.love,
              opacity: burst.interpolate({ inputRange: [0, 0.01, 0.6, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { rotate: `${deg}deg` },
                { translateX: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 14, 19] }) },
                { scale: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.9, 0.2] }) },
              ],
            }}
          />
        ))}
      </View>
      <View style={{ height: 16, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={{ opacity: roll.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, 14 * dir.current] }) }] }}>
          <Text style={{ fontSize: small ? 12 : 13, lineHeight: 16, fontWeight: '500', textAlign: 'center', color: liked ? colors.love : count > 0 ? colors.textSecondary : colors.mute, fontVariant: ['tabular-nums'] }}>{count}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

// 말풍선 + 이야기 수 — onPress가 없으면 표시만
export function TalkCount({ count, onPress, label }: { count: number; onPress?: () => void; label?: string }) {
  const body = (
    <>
      <CIcon name="chat" size={20} color={colors.textSecondary} />
      <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '500', color: count > 0 ? colors.textSecondary : colors.mute, fontVariant: ['tabular-nums'] }}>{count}</Text>
    </>
  );
  const box = { minWidth: 44, height: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 } as const;
  if (!onPress) return <View accessibilityLabel={label ?? `이야기 ${count}`} style={box}>{body}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? `이야기 ${count}`} style={box}>{body}</Pressable>;
}
