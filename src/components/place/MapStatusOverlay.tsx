// 지도 불러오는 중 · 실패 — 지도 카드 위에 상태 글(12 글자-안내), 실패하면 아래에 흰 알약 버튼 '다시 불러오기'
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../../tokens';

export function MapStatusOverlay({ status, onRetry }: { status: 'loading' | 'error'; onRetry?: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.sub }}>
        {status === 'loading' ? '지도를 불러오고 있어요.' : '지도를 불러오지 못했어요.'}
      </Text>
      {status === 'error' && onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" style={{ height: 44, justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.text }}>다시 불러오기</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
