// 야화 — 잠금 상태 콘텐츠 블러. web/native 모두 동작.
//   web: CSS filter: blur(Npx) + select-none (텍스트 복사 차단)
//   native: BlurView 절대 위치 오버레이
import React from 'react';
import { Platform, View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export function LockedBlur({
  locked,
  intensity = 14,
  children,
  style,
}: {
  locked: boolean;
  intensity?: number;  // 0-24 px (web blur radius)
  children: React.ReactNode;
  style?: ViewProps['style'];
}) {
  if (!locked) return <View style={style}>{children}</View>;

  if (Platform.OS === 'web') {
    return (
      <View
        // @ts-ignore — RN-web에서 inline web style 통과
        style={[style, {
          filter: `blur(${intensity}px)`,
          userSelect: 'none',
          pointerEvents: 'none',
        } as any]}
      >
        {children}
      </View>
    );
  }

  // native: BlurView overlay
  return (
    <View style={[style, { position: 'relative' }]} pointerEvents="none">
      {children}
      <BlurView
        intensity={Math.min(100, intensity * 5)}
        tint="light"
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
