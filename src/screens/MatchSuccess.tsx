// 야화 — 매칭 완료 "꽃이 피었어요" (project/야화/screens.jsx MatchDone 픽셀 포트)
// 리디자인(1010) — 그라데이션·장식 문자 대신 와인 단색 바탕 + 차분한 타이포.
// 감싸는 SafeAreaView(app/index.tsx)가 colors.primary라 바탕색을 맞춘다.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../tokens';
import { Icons } from '../icons';
import { pressFx } from '../lib/press';

export function MatchSuccess({ onStart, onLater }: { onStart?: () => void; onLater?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}>
      <View style={{ flexDirection: 'row', marginBottom: 32 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icons.user size={36} color={colors.primary} stroke={1.5} />
        </View>
        <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', marginLeft: -20 }}>
          <Icons.user size={36} color={colors.sub} stroke={1.5} />
        </View>
      </View>

      <Text style={{ fontSize: 27, fontWeight: '700', color: colors.surface, letterSpacing: -0.8 }}>꽃이 피었어요</Text>
      <Text
        style={{
          marginTop: 12,
          fontSize: 13.5,
          color: colors.surface,
          opacity: 0.88,
          lineHeight: 22,
          maxWidth: 300,
          textAlign: 'center',
        }}
      >
        재즈러버 님과 서로 좋아요!{'\n'}이제 얼굴이 공개되고 채팅을 시작할 수 있어요.
      </Text>

      <View style={{ width: '100%', maxWidth: 340, marginTop: 40, gap: 4 }}>
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: 56, borderRadius: 14, backgroundColor: colors.surface,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            ...pressFx(pressed),
          })}
        >
          <Icons.send size={18} color={colors.primary} stroke={1.5} />
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.primary }}>대화 시작하기</Text>
        </Pressable>
        <Pressable
          onPress={onLater}
          accessibilityRole="button"
          style={({ pressed }) => ({ height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontSize: 13.5, color: colors.surface, opacity: 0.85 }}>나중에</Text>
        </Pressable>
      </View>
    </View>
  );
}
