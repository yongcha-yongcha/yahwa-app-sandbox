// 야화 — 리프 충전 결제 트리거 페이지. 네이티브 앱이 인앱 브라우저로 이 페이지를 열면
// 웹 토스 결제 로직(requestLeafPayment)을 실행해 결제창으로 진입하고, /pay-success로 리다이렉트한다.
// (네이티브는 requestLeafPaymentNative가 리다이렉트를 가로채 서버 confirm까지 처리)
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../src/tokens';
import { requestLeafPayment } from '../src/lib/tosspay';

export default function LeafPay() {
  const params = useLocalSearchParams<{ leaf?: string; won?: string; uid?: string; bridge?: string }>();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
    const leaf = Number(first(params.leaf));
    const won = Number(first(params.won));
    const uid = first(params.uid) ?? '';
    if (!leaf || !won) { setErr('결제 정보가 올바르지 않아요'); return; }
    requestLeafPayment({ n: leaf, won, orderName: '야화컴퍼니(주) 리프' }, uid, 'card', !!params.bridge).catch((e: any) => {
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
