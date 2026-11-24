// 야화 — 토스 결제 실패 콜백
import { Icons } from '../src/icons';
import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../src/tokens';
import { Btn } from '../src/components/atoms';

export default function PayFail() {
  const params = useLocalSearchParams<{ message?: string; code?: string; bridge?: string }>();
  const router = useRouter();
  // 네이티브에서 시작된 결제(bridge=1)는 시스템 브라우저에서 실패 페이지가 뜬다 —
  // "홈으로"는 웹 홈으로 가버려 막다른 길이므로, 앱 딥링크로 되돌린다.
  const fromApp = params.bridge === '1';
  function goBack() {
    if (fromApp && typeof window !== 'undefined') {
      window.location.replace('yahwa://');
      return;
    }
    router.replace('/');
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Icons.info size={36} color={colors.mute} stroke={1.5} />
      <Text style={{ marginTop: 14, fontSize: 18, fontWeight: '800', color: colors.text }}>결제가 취소됐어요</Text>
      <Text style={{ marginTop: 8, fontSize: 11.5, color: colors.sub, textAlign: 'center' }}>
        {params.message ?? '결제 창에서 취소했거나 오류가 발생했어요.'}
      </Text>
      <View style={{ marginTop: 24, width: '100%', maxWidth: 320 }}>
        <Btn kind="primary" full size="lg" onPress={goBack}>
          {fromApp ? '앱으로 돌아가기' : '홈으로'}
        </Btn>
      </View>
    </View>
  );
}
