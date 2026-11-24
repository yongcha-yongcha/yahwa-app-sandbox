// 야화 — 네이티브 결제 복귀 브릿지.
// 네이티브는 결제를 시스템 브라우저(Safari)에서 진행한다(인앱 ASWebAuthenticationSession은
// supertoss://·앱카드 같은 타 앱 스킴을 열지 못해 결제가 진행되지 않음).
// 토스가 이 페이지로 successUrl 리다이렉트를 보내면, 받은 파라미터를 그대로 실어
// yahwa://pay-success 딥링크로 앱에 되돌려준다. 실제 confirm·적립은 앱의 /pay-success가 한다.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../src/tokens';
import { Btn } from '../src/components/atoms';

export default function PayBridge() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [stuck, setStuck] = useState(false);
  // 첫 파라미터로 한 번만 만든다(자동 이동과 버튼이 같은 링크)
  const deepLink = useMemo(() => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val != null) qs.set(k, String(val));
    }
    return `yahwa://pay-success?${qs.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = () => { if (typeof window !== 'undefined') window.location.replace(deepLink); };

  useEffect(() => {
    open();
    // 딥링크가 자동으로 안 열리는 환경(브라우저가 막음 등) — 버튼으로 직접 연다
    const t = setTimeout(() => setStuck(true), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {!stuck && <ActivityIndicator color={colors.primary} />}
      <Text style={{ marginTop: 14, fontSize: 12.5, color: colors.sub, textAlign: 'center' }}>
        {stuck ? '아래 버튼을 눌러 앱으로 돌아가 주세요.\n앱으로 돌아가야 결제가 확정돼요.' : '앱으로 돌아가는 중…'}
      </Text>
      {stuck && (
        <View style={{ marginTop: 24, width: '100%', maxWidth: 320 }}>
          <Btn kind="primary" full size="lg" onPress={open}>
            앱으로 돌아가기
          </Btn>
        </View>
      )}
    </View>
  );
}
