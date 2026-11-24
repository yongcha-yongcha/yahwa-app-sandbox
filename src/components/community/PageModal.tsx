// 야화 — 커뮤니티 안에서 여는 전체 화면(이용수칙 · 이야기 쓰기). 화면 스택(app/index의 오버레이)에 자리를 만들지 않고도
// 쌓이는 화면처럼 보이게: 오른쪽에서 300ms로 밀려 들어오고 뒤로 가면 280ms로 밀려 나간다(spec-shell 화면 전환 값). 움직임 줄이기면 160ms 페이드.
// 앱 Modal 안에서는 위 안전 영역이 0으로 잡혀 머리 줄이 상태바 밑에 숨는다 — 바깥 화면 값으로 띄운다(1016).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dur, ease } from '../../tokens';
import { NATIVE, reduceMotion } from '../../ui';

export function PageModal({ open, onRequestClose, children }: { open: boolean; onRequestClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;  // 0 밖 → 1 들어옴
  useEffect(() => {
    const still = reduceMotion();
    if (open) {
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: still ? dur.reduced : dur.push, easing: ease.drawer, useNativeDriver: NATIVE }).start();
    } else {
      Animated.timing(v, { toValue: 0, duration: still ? dur.reduced : dur.pop, easing: ease.drawer, useNativeDriver: NATIVE })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [open, v]);
  if (!mounted) return null;
  const still = reduceMotion();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View
        style={[
          { flex: 1, backgroundColor: colors.bg, paddingTop: insets.top },
          still ? { opacity: v } : { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) }] },
        ]}
      >
        {children}
      </Animated.View>
    </Modal>
  );
}
