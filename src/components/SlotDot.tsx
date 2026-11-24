// 야화 — 게더링 슬롯 시각화 (직관 UI)
// 채워진 자리: 실 프로필 사진 (블러 X)
// 빈자리: 회색 동그라미
import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius } from '../tokens';
import type { GatherSlot } from '../data/mock';

// 성별 테두리 색 — 남=파랑, 여=주황(브랜드). 성별 미상은 기존 규칙(호스트=주황, 그 외 흰색).
const GENDER_BLUE = '#3B82F6';
function slotBorderColor(s: GatherSlot): string {
  if (s.gender === 'M') return GENDER_BLUE;
  if (s.gender === 'F') return colors.primary;
  return s.host ? colors.primary : '#fff';
}

export function SlotDot({ s, size = 26 }: { s: GatherSlot; size?: number }) {
  if (s.filled) {
    if (s.photo) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: slotBorderColor(s),
            backgroundColor: colors.bgSoft,
            position: 'relative',
          }}
        >
          <Image
            source={typeof s.photo === 'string' ? { uri: s.photo } : s.photo}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
          {s.host && (
            <View
              style={{
                position: 'absolute',
                bottom: -3,
                right: -3,
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
                borderWidth: 1.5,
                borderColor: '#fff',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 10 }}>H</Text>
            </View>
          )}
        </View>
      );
    }
    // photo 없는 filled — 브랜드 주황색 채움 + 흰 사람 실루엣
    const ico = Math.round(size * 0.52);
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: s.gender === 'M' ? GENDER_BLUE : s.gender === 'F' ? colors.primary : (s.host ? colors.primaryDark : '#fff'),
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* 사람 머리 */}
        <View
          style={{
            width: ico * 0.42,
            height: ico * 0.42,
            borderRadius: ico * 0.21,
            backgroundColor: colors.surface,
            marginBottom: -ico * 0.04,
            opacity: 0.95,
          }}
        />
        {/* 어깨 */}
        <View
          style={{
            width: ico * 0.78,
            height: ico * 0.4,
            borderTopLeftRadius: ico * 0.4,
            borderTopRightRadius: ico * 0.4,
            backgroundColor: colors.surface,
            opacity: 0.95,
          }}
        />
        {s.host && (
          <View
            style={{
              position: 'absolute',
              bottom: -3,
              right: -3,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: radius.pill,
              backgroundColor: colors.primaryDark,
              borderWidth: 1.5,
              borderColor: '#fff',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 10 }}>H</Text>
          </View>
        )}
      </View>
    );
  }
  // 빈자리 — 점선 테두리 + 흐릿한 사람 실루엣 (클릭 아닌 "비어있음" 시각화)
  const ico = Math.round(size * 0.52);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.line,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7,
      }}
    >
      {/* 사람 머리 */}
      <View
        style={{
          width: ico * 0.42,
          height: ico * 0.42,
          borderRadius: ico * 0.21,
          backgroundColor: colors.line,
          marginBottom: -ico * 0.04,
        }}
      />
      {/* 어깨 (반원) */}
      <View
        style={{
          width: ico * 0.78,
          height: ico * 0.4,
          borderTopLeftRadius: ico * 0.4,
          borderTopRightRadius: ico * 0.4,
          backgroundColor: colors.line,
        }}
      />
    </View>
  );
}

export function SlotRow({ slots, label, size = 26 }: { slots: GatherSlot[]; label: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.sub, minWidth: 28 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {slots.map((s, i) => (
          <SlotDot key={i} s={s} size={size} />
        ))}
      </View>
    </View>
  );
}
