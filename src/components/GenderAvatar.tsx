// 야화 — 커뮤니티 익명 프로필 아바타. 성별을 색 점이 아니라 프사 자체로 확실히 구분한다.
// 여성: 브랜드 레드 계열 + ♀ 배지, 남성: 블루 계열 + ♂ 배지, 미상: 그레이(배지 없음).
import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../tokens';
import { Icons } from '../icons';

const MALE_BLUE = '#3B82F6';
const MALE_BLUE_DARK = '#2563EB';

export function GenderAvatar({ gender, size = 32 }: { gender?: 'M' | 'F' | null; size?: number }) {
  const known = gender === 'M' || gender === 'F';
  const grad: [string, string] =
    gender === 'F' ? ['#D96A61', colors.primary]
    : gender === 'M' ? [MALE_BLUE, MALE_BLUE_DARK]
    : [colors.line, colors.mute];
  const badgeSize = Math.max(13, Math.round(size * 0.44));
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icons.user size={size * 0.55} color="rgba(255,255,255,0.95)" />
      </LinearGradient>
      {known && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: gender === 'F' ? colors.primary : MALE_BLUE,
            borderWidth: 1.5,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: badgeSize * 0.68,
              fontWeight: '800',
              lineHeight: badgeSize * 0.82,
              // @ts-ignore Android-only — 폰트 상하 여백 제거로 배지 중앙 정렬
              includeFontPadding: false,
            }}
          >
            {gender === 'F' ? '♀' : '♂'}
          </Text>
        </View>
      )}
    </View>
  );
}
