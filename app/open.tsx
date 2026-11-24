// 야화 — 스마트 딥링크 랜딩. 마케팅에 뿌리는 단일 링크: https://yahwa.vercel.app/open
// 앱이 설치돼 있으면 yahwa:// 스킴으로 바로 열고, 없으면(전환 실패) /download로 폴백해 스토어로 보낸다.
// ?c=쿠폰코드 등 쿼리는 앱 딥링크와 /download 양쪽에 그대로 전달한다.
import React, { useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius } from '../src/tokens';
import { Icons } from '../src/icons';

export default function Open() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const qs = window.location.search || '';
    const fallback = `/download${qs}`;

    // 데스크톱은 앱이 없으니 바로 다운로드 랜딩으로.
    const ua = navigator.userAgent || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (!isMobile) {
      window.location.replace(fallback);
      return;
    }

    // 앱 실행 시도 — 성공하면 브라우저가 백그라운드로 가므로(hidden) 폴백을 취소한다.
    // 딥링크는 루트(yahwa://)로 — 구버전 앱에도 항상 존재하는 라우트라 Unmatched Route가 안 뜬다.
    let cancelled = false;
    const onHide = () => { cancelled = true; };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);

    window.location.href = `yahwa://${qs}`;
    const t = setTimeout(() => {
      if (!cancelled && document.visibilityState === 'visible') {
        window.location.replace(fallback);
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // 네이티브에서 이 라우트가 열리면(예: 구링크 yahwa://open) 홈으로 — 랜딩 화면이 앱 안에 뜨지 않게.
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }

  // 전환 대기 중 잠깐 보이는 화면 + 수동 버튼(자동 실패 대비)
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{
        width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primarySoft,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.leaf size={38} color={colors.primary} />
      </View>
      <Text style={{ marginTop: 18, fontSize: 21.5, fontWeight: '800', color: colors.text }}>야화</Text>
      <Text style={{ marginTop: 8, fontSize: 12.5, color: colors.sub, textAlign: 'center', lineHeight: 19 }}>
        앱으로 이동 중이에요…
      </Text>
      <Pressable
        onPress={() => {
          if (typeof window !== 'undefined') window.location.href = `/download${window.location.search || ''}`;
        }}
        style={{
          marginTop: 28, paddingHorizontal: 24, paddingVertical: 13,
          borderRadius: radius.pill, backgroundColor: colors.primary,
        }}
      >
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#fff' }}>앱이 없다면 설치하기</Text>
      </Pressable>
    </View>
  );
}
