// 야화 — 눌림이 부드럽게 들어가고 돌아오는 Pressable(공용 눌림 값 lib/press)
// Pressable과 같은 속성. style이 함수면 { pressed }를 넘겨 준다. 크기·투명도 변화는 여기서 맡는다
// (style 쪽 pressFx가 있어도 이 값이 뒤에서 덮는다). 앱은 네이티브 드라이버로 움직인다.
// target='label'이면 버튼은 그대로 두고 usePressScale로 받은 값을 안쪽(글씨·아이콘)에 건다.
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle, type View } from 'react-native';
import { PRESS, PRESS_EASE, pressFx } from '../lib/press';

const native = Platform.OS !== 'web';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function usePressScale(scale: number = PRESS.scale) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.timing(v, { toValue: x, duration: PRESS.ms, easing: PRESS_EASE, useNativeDriver: native }).start();
  return { anim: v, pressIn: () => to(scale), pressOut: () => to(1) };
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  fx?: boolean;          // false면 눌림 효과 없음
  scale?: number;
  press?: ReturnType<typeof usePressScale>;  // 바깥에서 만든 값(안쪽 글씨에 걸 때)
  scaleSelf?: boolean;   // false면 버튼 자체는 크기를 바꾸지 않는다(탭)
};

export const Tap = React.forwardRef<View, Props>(function Tap(
  { style, fx = true, scale, press, scaleSelf = true, onPressIn, onPressOut, disabled, ...rest },
  ref,
) {
  const own = usePressScale(scale);
  const p = press ?? own;
  const [pressed, setPressed] = useState(false);
  const on = fx && !disabled;
  const base = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      ref={ref as any}
      disabled={disabled}
      {...rest}
      onPressIn={(e) => { setPressed(true); if (on) p.pressIn(); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); p.pressOut(); onPressOut?.(e); }}
      // 앱: 애니메이션 값으로 크기를 바꾼다(놓으면 0.22초 되돌림). 웹: CSS transition(pressFx)으로 같은 움직임
      style={[
        base,
        on && pressed ? { opacity: PRESS.opacity } : null,
        on && scaleSelf ? (native ? { transform: [{ scale: p.anim }] } : pressFx(pressed, scale)) : null,
      ]}
    />
  );
});
