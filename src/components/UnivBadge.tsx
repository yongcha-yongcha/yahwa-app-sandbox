// 야화 — 대학교 인증 금색 뱃지. 대학명 텍스트를 골드 그라데이션 필에 표시.
// BadgeManage 외에 오늘의 친구/모임 카드 등에서 재사용 예정.
import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../tokens';
import { Icons } from '../icons';

const SIZES = {
  sm: { h: 22, px: 9, fs: 10, gap: 3, icon: 11 },
  md: { h: 30, px: 13, fs: 11.5, gap: 4, icon: 13 },
} as const;

export function UnivBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const s = SIZES[size];
  return (
    <LinearGradient
      colors={['#F5D98B', '#E5B33E', '#C9962E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: s.h,
        paddingHorizontal: s.px,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: s.gap,
        alignSelf: 'flex-start',
      }}
    >
      <Icons.gradCap size={s.icon} color="#5B4200" />
      <View style={{ flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: s.fs,
            fontWeight: '800',
            color: '#5B4200',
            lineHeight: s.fs * 1.3,
            // @ts-ignore Android-only style — RN-web/iOS는 무시
            includeFontPadding: false,
          }}
        >
          {name}
        </Text>
      </View>
    </LinearGradient>
  );
}
