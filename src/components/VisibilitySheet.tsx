// 야화 — 인연 쉬어가기(공개 끄기 · 다시 켜기). 쉬어가기 = 0108 플래그 두 개(affinityHidden · affinityDeckPaused)를 같이 켜고 끈다.
// 저장 방식: 로컬 먼저 반영 → 서버 저장 → 실패 시 원복 + 알림 한 줄.
// useResting은 MY › 인연 공개 화면이, VisibilitySheet(확인 시트)는 인연 홈이 쓴다.
import React from 'react';
import { Pressable, View } from 'react-native';
import { previewActions, previewSelectors, usePreview } from '../lib/previewStore';
import { updateUserProfileServer } from '../lib/api';
import { BottomSheet, Button } from '../ui';
import { Text } from 'react-native';
import { colors } from '../tokens';

export function useResting() {
  const profile = usePreview(previewSelectors.myProfile);
  // 공개 중 = 두 플래그가 모두 꺼져 있을 때
  const resting = !!profile.affinityHidden || !!profile.affinityDeckPaused;
  function setResting(next: boolean) {
    const prev = { affinityHidden: profile.affinityHidden, affinityDeckPaused: profile.affinityDeckPaused };
    previewActions.updateMyProfile({ affinityHidden: next, affinityDeckPaused: next });
    updateUserProfileServer({ affinityHidden: next, affinityDeckPaused: next }).catch(() => {
      // 서버 저장 실패 — 원복 + 안내 (설정은 서버가 강제하는 값이라 로컬만 남기면 안 됨)
      previewActions.updateMyProfile(prev);
      previewActions.showToast('설정 저장에 실패했어요. 잠시 후 다시 시도해주세요', 2400);
    });
    if (!next) previewActions.showToast('다시 공개했어요');
  }
  return { resting, setResting };
}

// 쉬어가기 확인 시트 — 끌 때만 묻는다(쉬는 중이면 '다시 공개하기')
export function VisibilitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { resting, setResting } = useResting();
  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* 시안 .ip-sheet — 위 8 · 제목 18/26 → 16 → 사실 줄(사이 12) → 16 → 주 버튼 → 16 → 글자 버튼 44 */}
      <Text accessibilityRole="header" style={{ marginTop: 8, fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.text, marginBottom: 16 }}>{resting ? '다시 공개할까요?' : '잠시 쉬어갈까요?'}</Text>
      <View style={{ gap: 12, marginBottom: 16 }}>
        {resting ? (
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>다음 소개 시간부터 오늘의 인연에 다시 소개돼요</Text>
        ) : (
          <>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>쉬는 동안 내 프로필이 소개되지 않고, 나도 다른 인연을 볼 수 없어요</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>편지 보관 기간은 그대로 흘러가요</Text>
          </>
        )}
      </View>
      <Button size="sheet" block label={resting ? '다시 공개하기' : '쉬어가기'} onPress={() => { setResting(!resting); onClose(); }} />
      <Pressable onPress={onClose} accessibilityRole="button" style={{ marginTop: 16, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>{resting ? '계속 쉬어가기' : '계속 공개하기'}</Text>
      </Pressable>
    </BottomSheet>
  );
}
