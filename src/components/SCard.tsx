// 야화 — 섹션 카드 (screens-detail.jsx SCard 픽셀 포트)
import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../tokens';

export function SCard({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          marginHorizontal: 16,
          marginTop: 12,
          paddingHorizontal: 18,
          paddingVertical: 16,
          backgroundColor: colors.surface,
          borderRadius: radius.card,
        },
        shadow.card as any,
        style,
      ]}
    >
      {(title || right) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.sub }}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}
