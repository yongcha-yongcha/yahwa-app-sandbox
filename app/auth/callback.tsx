// 야화 — OAuth 콜백 라우트 (yahwa://auth/callback?code=...)
//
// 배경: 네이티브 카카오 로그인은 WebBrowser.openAuthSessionAsync가 리다이렉트를 가로채
// 그 자리에서 코드 교환을 끝내도록 설계돼 있다(src/lib/auth.ts). 그런데 카카오톡 앱을
// 거쳐 돌아오는 app-to-app 경로에서는 그 캡처가 깨지고, OS가 yahwa:// 스킴으로 앱을
// 새로 띄워버린다. 그때 이 라우트가 없으면 expo-router가 "Unmatched Route"를 낸다.
// → 딥링크로 들어와도 로그인이 완성되도록 하는 폴백. (정상 캡처 시엔 이 화면을 안 거친다)
//
// 주의:
//  - 이동은 반드시 <Redirect>로 한다. 딥링크 콜드스타트에서는 루트 레이아웃이 마운트되기
//    전에 router.replace()를 호출하게 되어 앱이 종료된다.
//  - WebBrowser.dismissBrowser()는 호출하지 않는다. 스킴 리다이렉트 시 브라우저는 스스로
//    닫히며, 여기서 강제로 닫으면 네이티브 액티비티 스택을 건드려 앱이 꺼질 수 있다.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/tokens';

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
    error_description?: string | string[];
  }>();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);
  // 코드는 1회용이라 재렌더로 두 번 교환되면 실패한다 — 1회로 고정
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
    const code = first(params.code);
    const accessToken = first(params.access_token);
    const refreshToken = first(params.refresh_token);
    const errDesc = first(params.error_description);

    (async () => {
      try {
        if (errDesc) throw new Error(errDesc);

        if (code) {
          // PKCE — code_verifier는 로그인 시작 시 같은 앱 저장소에 저장돼 있다.
          // 단 auth.ts의 openAuthSessionAsync 경로가 먼저 교환을 끝냈을 수 있다(경합).
          // code는 1회용이라 그 경우 여기선 실패하는데, 세션이 이미 있으면 성공으로 본다.
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) {
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw e;
          }
        } else if (accessToken && refreshToken) {
          const { error: e } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (e) throw e;
        } else {
          // 브라우저 캡처가 먼저 끝나 세션이 이미 있으면 그대로 통과
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('인증 정보가 없어요. 다시 로그인해주세요.');
        }
        setStatus('done');
      } catch (e: any) {
        setError(e?.message ?? '로그인을 완료하지 못했어요.');
        setStatus('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 성공/실패 모두 홈으로 — <Redirect>가 네비게이션 준비 시점을 알아서 기다린다.
  // (실패해도 로그인 화면이 홈에서 다시 뜨므로 막다른 화면이 없다)
  if (status === 'done') return <Redirect href="/" />;
  if (status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
          로그인을 완료하지 못했어요
        </Text>
        <Text style={{ marginTop: 8, fontSize: 11.5, color: colors.sub, textAlign: 'center' }}>{error}</Text>
        <Text style={{ marginTop: 16, fontSize: 11, color: colors.mute }}>잠시 후 처음 화면으로 이동해요…</Text>
        <DelayedHome />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ marginTop: 12, fontSize: 11.5, color: colors.sub }}>로그인 중이에요…</Text>
    </View>
  );
}

// 에러 문구를 잠깐 보여준 뒤 홈으로 — 사용자가 콜백 화면에 갇히지 않게.
function DelayedHome() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 2500);
    return () => clearTimeout(t);
  }, []);
  return go ? <Redirect href="/" /> : null;
}
