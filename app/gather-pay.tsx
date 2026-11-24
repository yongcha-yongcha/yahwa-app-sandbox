// 야화 — 모임 참가비 결제 트리거 페이지. 네이티브 앱이 인앱 브라우저(WebBrowser.openAuthSessionAsync)로
// 이 페이지를 열면, 여기서 기존 웹 결제 로직(requestGatheringPayment)을 그대로 실행해 토스 결제창으로
// 진입한다. 이 페이지 자체는 항상 실제 브라우저 컨텍스트(웹 또는 인앱 브라우저)에서만 렌더된다.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../src/tokens';
import { requestGatheringPayment } from '../src/lib/tosspay';

export default function GatherPay() {
  const params = useLocalSearchParams<{ gatheringId?: string; amount?: string; gender?: string; bridge?: string }>();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const gatheringId = Array.isArray(params.gatheringId) ? params.gatheringId[0] : params.gatheringId;
    const amount = Number(Array.isArray(params.amount) ? params.amount[0] : params.amount);
    const gender = (Array.isArray(params.gender) ? params.gender[0] : params.gender) === 'F' ? 'F' : 'M';
    if (!gatheringId || !amount) { setErr('결제 정보가 올바르지 않아요'); return; }
    requestGatheringPayment({ gatheringId, amount, gender, bridge: !!params.bridge }).catch((e: any) => {
      setErr(e?.message ?? '결제창을 열지 못했어요');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {err ? (
        <Text style={{ fontSize: 12.5, color: colors.sub, textAlign: 'center' }}>{err}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 14, fontSize: 12.5, color: colors.sub }}>결제창으로 이동 중…</Text>
        </>
      )}
    </View>
  );
}
